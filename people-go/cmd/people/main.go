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

	// ── Fetch latest SHA ──────────────────────────────────────────────────
	fc := fetcher.New(ctx, token)
	latestSHA, err := fc.LatestSHA(ctx)
	if err != nil {
		log.Fatalf("latest SHA: %v", err)
	}

	if cached.LastSHA == latestSHA {
		log.Printf("no changes since %s — nothing to do", cached.LastSHA[:8])
		// Still write empty changelog if it doesn't exist yet
		if err := ensureChangelog(outDir); err != nil {
			log.Fatalf("ensure changelog: %v", err)
		}
		return
	}

	log.Printf("new commits detected: %s → %s", shortSHA(cached.LastSHA), latestSHA[:8])

	// ── Fetch people.json ─────────────────────────────────────────────────
	people, err := fc.FetchPeople(ctx, latestSHA)
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
	events := differ.Compute(previous, currentMap, now)
	log.Printf("delta: %d events", len(events))

	// ── Enrich with GitHub API ────────────────────────────────────────────
	// Only enrich people who have a valid GitHub handle.
	// Cap at 50 enrichments per run to avoid hitting rate limits.
	if token != "" && len(events) > 0 {
		apiCache, err := apicache.Load(cacheDir)
		if err != nil {
			log.Printf("warn: load api cache: %v", err)
		}

		ghClient := githubclient.New(ctx, token)
		enriched := 0
		const maxEnrich = 50
		for i, e := range events {
			if enriched >= maxEnrich {
				break
			}
			if e.Person.Handle == "" {
				continue
			}
			if e.Type == models.EventAdded || e.Type == models.EventUpdated {
				stats := ghClient.Enrich(ctx, e.Person.Handle, apiCache)
				if stats.AvatarURL != "" {
					events[i].Person.AvatarURL = stats.AvatarURL
					events[i].Person.Contributions = stats.Contributions
					events[i].Person.Followers = stats.Followers
					events[i].Person.PublicRepos = stats.PublicRepos
					enriched++
				}
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
	if err := stateMgr.SaveState(state.State{LastSHA: latestSHA, UpdatedAt: now}); err != nil {
		log.Fatalf("save state: %v", err)
	}
	log.Printf("done — state saved at SHA %s", latestSHA[:8])
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

