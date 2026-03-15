package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/castrojo/people-website/people-go/internal/apicache"
	"github.com/castrojo/people-website/people-go/internal/differ"
	"github.com/castrojo/people-website/people-go/internal/fetcher"
	githubclient "github.com/castrojo/people-website/people-go/internal/github"
	"github.com/castrojo/people-website/people-go/internal/models"
	"github.com/castrojo/people-website/people-go/internal/state"
	"github.com/castrojo/people-website/people-go/internal/writer"
)

const (
	cacheDir = "../.sync-cache"
	outDir   = "../src/data"
)

func main() {
	ctx := context.Background()
	token := os.Getenv("GITHUB_TOKEN")

	// ── State ─────────────────────────────────────────────────────────────
	stateMgr, err := state.New(cacheDir)
	if err != nil {
		log.Fatalf("state manager: %v", err)
	}

	cached, err := stateMgr.LoadState()
	if err != nil {
		log.Fatalf("load state: %v", err)
	}

	fc := fetcher.New(ctx, token)

	// ── Check both upstreams independently ────────────────────────────────
	latestPeopleSHA, err := fc.LatestSHA(ctx)
	if err != nil {
		log.Fatalf("latest people SHA: %v", err)
	}
	latestLandscapeSHA, err := fc.LatestLandscapeSHA(ctx)
	if err != nil {
		log.Printf("warn: latest landscape SHA: %v — skipping landscape sync", err)
		latestLandscapeSHA = cached.LandscapeSHA // treat as unchanged on error
	}

	syncPeople := latestPeopleSHA != cached.LastSHA
	syncLandscape := latestLandscapeSHA != cached.LandscapeSHA

	if !syncPeople && !syncLandscape {
		log.Printf("no changes in cncf/people (%s) or cncf/landscape (%s) — nothing to do",
			shortSHA(latestPeopleSHA), shortSHA(latestLandscapeSHA))
		if err := ensureChangelog(outDir); err != nil {
			log.Fatalf("ensure changelog: %v", err)
		}
		return
	}

	// ── Sync landscape logos ──────────────────────────────────────────────
	if syncLandscape {
		log.Printf("cncf/landscape updated: %s → %s — syncing logos",
			shortSHA(cached.LandscapeSHA), shortSHA(latestLandscapeSHA))
		logos, err := fc.FetchLandscapeLogos(ctx)
		if err != nil {
			log.Printf("warn: fetch landscape logos: %v — keeping existing landscape_logos.json", err)
		} else {
			if err := writer.WriteLandscapeLogos(outDir, logos); err != nil {
				log.Fatalf("write landscape_logos.json: %v", err)
			}
			log.Printf("wrote landscape_logos.json (%d entries)", len(logos))
			cached.LandscapeSHA = latestLandscapeSHA
		}
	}

	// ── Sync people ───────────────────────────────────────────────────────
	if !syncPeople {
		log.Printf("cncf/people unchanged (%s) — skipping people sync", shortSHA(latestPeopleSHA))
		if err := stateMgr.SaveState(state.State{
			LastSHA:      cached.LastSHA,
			LandscapeSHA: cached.LandscapeSHA,
			UpdatedAt:    time.Now().UTC(),
		}); err != nil {
			log.Fatalf("save state: %v", err)
		}
		return
	}

	log.Printf("cncf/people updated: %s → %s", shortSHA(cached.LastSHA), shortSHA(latestPeopleSHA))

	// ── Fetch people.json ─────────────────────────────────────────────────
	people, err := fc.FetchPeople(ctx, latestPeopleSHA)
	if err != nil {
		log.Fatalf("fetch people: %v", err)
	}
	log.Printf("fetched %d people", len(people))

	currentMap := models.RawPeopleMap(people)

	previous, err := stateMgr.LoadPrevious()
	if err != nil {
		log.Fatalf("load previous: %v", err)
	}

	// ── Compute delta ─────────────────────────────────────────────────────
	now := time.Now().UTC()
	isBootstrap := len(previous) == 0
	events := differ.Compute(previous, currentMap, now)
	log.Printf("delta: %d events", len(events))

	// ── Enrich with GitHub API ────────────────────────────────────────────
	// Only enrich people who have a valid GitHub handle.
	// Cap at 50 enrichments per run to avoid hitting rate limits.
	// CNCF years search (1 extra REST call per person) is skipped on bootstrap
	// to avoid hammering the API for thousands of people on first import.
	if token != "" && len(events) > 0 {
		apiCache, err := apicache.Load(cacheDir)
		if err != nil {
			log.Printf("warn: load api cache: %v", err)
		}

		ghClient := githubclient.New(ctx, token)
		enriched := 0
		for i, e := range events {
			if e.Person.Handle == "" {
				continue
			}
			if e.Type == models.EventAdded || e.Type == models.EventUpdated {
				stats := ghClient.Enrich(ctx, e.Person.Handle, apiCache)
				if stats.AvatarURL != "" {
					events[i].Person.AvatarURL = stats.AvatarURL
					events[i].Person.Contributions = stats.Contributions
					events[i].Person.PublicRepos = stats.PublicRepos
				}
				// Only search CNCF contribution history on incremental runs
				if !isBootstrap {
					ghClient.EnrichCNCFYears(ctx, e.Person.Handle, apiCache)
					if s, ok := apiCache.Get(e.Person.Handle); ok {
						events[i].Person.YearsContributing = s.YearsContributing
					}
				}
				enriched++
			}
		}
		log.Printf("enriched %d events", enriched)

		if err := apiCache.Save(); err != nil {
			log.Printf("warn: save api cache: %v", err)
		}
	}

	// ── Write outputs ─────────────────────────────────────────────────────
	if err := writer.WriteChangelog(outDir, events); err != nil {
		log.Fatalf("write changelog: %v", err)
	}
	log.Printf("wrote changelog.json (%d new events)", len(events))

	if err := writer.WriteRSS(outDir, events); err != nil {
		log.Printf("warn: write RSS: %v", err)
	}

	// ── Save state ────────────────────────────────────────────────────────
	if err := stateMgr.SavePrevious(currentMap); err != nil {
		log.Fatalf("save previous: %v", err)
	}
	if err := stateMgr.SaveState(state.State{
		LastSHA:      latestPeopleSHA,
		LandscapeSHA: cached.LandscapeSHA, // already updated above if synced
		UpdatedAt:    now,
	}); err != nil {
		log.Fatalf("save state: %v", err)
	}
	log.Printf("done — people SHA %s, landscape SHA %s", shortSHA(latestPeopleSHA), shortSHA(cached.LandscapeSHA))
}

func shortSHA(sha string) string {
	if len(sha) >= 8 {
		return sha[:8]
	}
	return "(none)"
}

func ensureChangelog(outDir string) error {
	path := outDir + "/changelog.json"
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := os.MkdirAll(outDir, 0o755); err != nil {
			return err
		}
		return os.WriteFile(path, []byte("[]"), 0o644)
	}
	return nil
}

// compile-time assertion to keep fmt imported
var _ = fmt.Sprintf

