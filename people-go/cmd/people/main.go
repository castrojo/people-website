package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
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

	// ── Init API cache + client early (used by both maintainer and people enrichment) ──
	var apiCache *apicache.Cache
	var ghClient *githubclient.Client
	if token != "" {
		apiCache, err = apicache.Load(cacheDir)
		if err != nil {
			log.Printf("warn: load api cache: %v", err)
		}
		ghClient = githubclient.New(ctx, token)
	}

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

	latestFoundationSHA, err := fc.LatestFoundationSHA(ctx)
	if err != nil {
		log.Printf("warn: latest foundation SHA: %v — skipping maintainers sync", err)
		latestFoundationSHA = cached.FoundationSHA // treat as unchanged on error
	}

	syncPeople := latestPeopleSHA != cached.LastSHA
	syncLandscape := latestLandscapeSHA != cached.LandscapeSHA
	syncFoundation := latestFoundationSHA != cached.FoundationSHA

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

	// ── Sync maintainers (cncf/foundation project-maintainers.csv) ───────
	if syncFoundation {
		log.Printf("cncf/foundation updated: %s → %s — syncing maintainers",
			shortSHA(cached.FoundationSHA), shortSHA(latestFoundationSHA))

		// Load logos for logo resolution (may already be loaded above; if not, use existing file).
		logoMap := map[string]string{}
		if logoData, err := os.ReadFile(fmt.Sprintf("%s/landscape_logos.json", outDir)); err == nil {
			_ = json.Unmarshal(logoData, &logoMap)
		}

		maintainers, newETag, notModified, err := fc.FetchMaintainersCSV(ctx, cached.FoundationETag, logoMap)
		if err != nil {
			log.Printf("warn: fetch maintainers CSV: %v — keeping existing maintainers.json", err)
		} else if notModified {
			log.Printf("maintainers CSV unchanged (ETag match) — skipping write")
			cached.FoundationSHA = latestFoundationSHA
		} else {
			// Diff new maintainers against existing to preserve enrichment and track UpdatedAt.
			existingMaintainers, _ := writer.LoadMaintainers(outDir)
			existingByHandle := make(map[string]models.SafeMaintainer, len(existingMaintainers))
			for _, m := range existingMaintainers {
				existingByHandle[m.Handle] = m
			}

			now := time.Now().UTC()
			for i, m := range maintainers {
				if existing, ok := existingByHandle[m.Handle]; ok {
					if maintainerDataChanged(existing, m) {
						maintainers[i].UpdatedAt = now
						if apiCache != nil {
							apiCache.Invalidate(m.Handle)
						}
					} else {
						// Carry forward existing timestamp and enriched fields.
						maintainers[i].UpdatedAt = existing.UpdatedAt
						maintainers[i].YearsContributing = existing.YearsContributing
						maintainers[i].Location = existing.Location
						maintainers[i].Bio = existing.Bio
						maintainers[i].CountryFlag = existing.CountryFlag
					}
				} else {
					maintainers[i].UpdatedAt = now // new maintainer
				}
			}

			if err := writer.WriteMaintainers(outDir, maintainers); err != nil {
				log.Fatalf("write maintainers.json: %v", err)
			}
			log.Printf("wrote maintainers.json (%d maintainers)", len(maintainers))
			cached.FoundationSHA = latestFoundationSHA
			cached.FoundationETag = newETag
		}
	}

	// ── Sync people ───────────────────────────────────────────────────────
	var events []models.Event
	var currentMap map[string]models.RawPerson

	if syncPeople {
		log.Printf("cncf/people updated: %s → %s", shortSHA(cached.LastSHA), shortSHA(latestPeopleSHA))

		people, err := fc.FetchPeople(ctx, latestPeopleSHA)
		if err != nil {
			log.Fatalf("fetch people: %v", err)
		}
		log.Printf("fetched %d people", len(people))

		currentMap = models.RawPeopleMap(people)

		previous, err := stateMgr.LoadPrevious()
		if err != nil {
			log.Fatalf("load previous: %v", err)
		}

		now := time.Now().UTC()
		_ = len(previous) == 0 // bootstrap detection reserved for future use
		events = differ.Compute(previous, currentMap, now)
		log.Printf("delta: %d events", len(events))

		// Write outputs before enrichment so a partial run always saves events.
		if err := writer.WriteChangelog(outDir, events); err != nil {
			log.Fatalf("write changelog: %v", err)
		}
		log.Printf("wrote changelog.json (%d new events)", len(events))

		if err := writer.BackfillPersonFields(outDir); err != nil {
			log.Printf("warn: backfill person fields: %v", err)
		}
		if err := writer.WriteRSS(outDir, events); err != nil {
			log.Printf("warn: write RSS: %v", err)
		}
		if err := writer.WriteStats(outDir); err != nil {
			log.Printf("warn: write stats.json: %v", err)
		}

		if err := stateMgr.SavePrevious(currentMap); err != nil {
			log.Fatalf("save previous: %v", err)
		}
		if err := stateMgr.SaveState(state.State{
			LastSHA:        latestPeopleSHA,
			LandscapeSHA:   cached.LandscapeSHA,
			FoundationSHA:  cached.FoundationSHA,
			FoundationETag: cached.FoundationETag,
			UpdatedAt:      now,
		}); err != nil {
			log.Fatalf("save state: %v", err)
		}
		log.Printf("done — people SHA %s, landscape SHA %s, foundation SHA %s",
			shortSHA(latestPeopleSHA), shortSHA(cached.LandscapeSHA), shortSHA(cached.FoundationSHA))
	} else {
		log.Printf("cncf/people unchanged (%s) — skipping people sync", shortSHA(latestPeopleSHA))
		if err := stateMgr.SaveState(state.State{
			LastSHA:        cached.LastSHA,
			LandscapeSHA:   cached.LandscapeSHA,
			FoundationSHA:  cached.FoundationSHA,
			FoundationETag: cached.FoundationETag,
			UpdatedAt:      time.Now().UTC(),
		}); err != nil {
			log.Fatalf("save state: %v", err)
		}
		if err := writer.BackfillPersonFields(outDir); err != nil {
			log.Printf("warn: backfill person fields: %v", err)
		}
		if err := writer.WriteStats(outDir); err != nil {
			log.Printf("warn: write stats.json: %v", err)
		}
	}

	if err := ensureChangelog(outDir); err != nil {
		log.Fatalf("ensure changelog: %v", err)
	}

	// ── Maintainer profile backfill (runs every run when token present) ───
	// Caps at 200 per run; saves cache every 50 to preserve partial progress on timeout.
	if apiCache != nil {
		maintainers, err := writer.LoadMaintainers(outDir)
		if err == nil && len(maintainers) > 0 {
			const cap = 200
			enriched, cncfYearsEnriched, changed := 0, 0, false
			for i, m := range maintainers {
				if enriched >= cap {
					break
				}
				if m.Handle == "" {
					continue
				}
				stats, ok := apiCache.Get(m.Handle)
				if ok && stats.AvatarURL != "" {
					// Apply cached enrichment even if fetched in a prior run.
					if maintainers[i].Location != stats.Location || maintainers[i].Bio != stats.Bio {
						maintainers[i].Location = stats.Location
						maintainers[i].Bio = stats.Bio
						maintainers[i].CountryFlag = models.CountryFlag(stats.Location)
						changed = true
					}
				} else {
					stats = ghClient.EnrichProfile(ctx, m.Handle, apiCache)
					if stats.AvatarURL != "" {
						maintainers[i].Location = stats.Location
						maintainers[i].Bio = stats.Bio
						maintainers[i].CountryFlag = models.CountryFlag(stats.Location)
						changed = true
					}
					enriched++
				}
				// Backfill CNCF years for maintainers, capped at 10 per run.
				if cncfYearsEnriched < 10 {
					if s, ok := apiCache.Get(m.Handle); !ok || s.YearsContributing == 0 {
						ghClient.EnrichCNCFYears(ctx, m.Handle, apiCache)
						cncfYearsEnriched++
					}
				}
				if s, ok := apiCache.Get(m.Handle); ok && s.YearsContributing > 0 && maintainers[i].YearsContributing != s.YearsContributing {
					maintainers[i].YearsContributing = s.YearsContributing
					changed = true
				}
				if enriched%50 == 0 && enriched > 0 {
					if err := apiCache.Save(); err != nil {
						log.Printf("warn: periodic cache save: %v", err)
					}
					if changed {
						if err := writer.WriteMaintainers(outDir, maintainers); err != nil {
							log.Printf("warn: periodic maintainers write: %v", err)
						}
					}
				}
			}
			if changed {
				if err := writer.WriteMaintainers(outDir, maintainers); err != nil {
					log.Printf("warn: write maintainers: %v", err)
				}
			}
			if enriched > 0 {
				log.Printf("maintainer backfill: enriched %d profiles (cap %d)", enriched, cap)
			}
			if err := apiCache.Save(); err != nil {
				log.Printf("warn: save api cache: %v", err)
			}
		}
	}

	// ── People enrichment ─────────────────────────────────────────────────
	// Capped at 200 per run. The api cache (90-day TTL) carries enrichment
	// forward across runs so the full community is gradually enriched over time.
	if apiCache != nil && len(events) > 0 {
		const enrichCap = 200
		enriched := 0
		for i, e := range events {
			if enriched >= enrichCap {
				break
			}
			if e.Person.Handle == "" {
				continue
			}
			if e.Type == models.EventAdded || e.Type == models.EventUpdated {
				if e.Type == models.EventUpdated {
					apiCache.Invalidate(e.Person.Handle)
				}
				stats := ghClient.Enrich(ctx, e.Person.Handle, apiCache)
				if stats.AvatarURL != "" {
					events[i].Person.AvatarURL = stats.AvatarURL
					events[i].Person.Contributions = stats.Contributions
					events[i].Person.PublicRepos = stats.PublicRepos
				}
				ghClient.EnrichCNCFYears(ctx, e.Person.Handle, apiCache)
				if s, ok := apiCache.Get(e.Person.Handle); ok {
					events[i].Person.YearsContributing = s.YearsContributing
				}
				enriched++
				if enriched%50 == 0 {
					if err := apiCache.Save(); err != nil {
						log.Printf("warn: periodic cache save: %v", err)
					}
				}
			}
		}
		log.Printf("enriched %d people (cap %d per run)", enriched, enrichCap)

		// ── Backfill CNCF years for special categories (TOC, TAB, Staff, GB) ──
		backfillCategories := map[string]bool{
			"TOC": true, "TAB": true, "Staff": true, "Governing Board": true,
		}
		patches := make(map[string]int)
		for _, person := range currentMap {
			safe := person.ToSafe()
			if safe.Handle == "" {
				continue
			}
			isSpecial := false
			for _, cat := range safe.Category {
				if backfillCategories[cat] {
					isSpecial = true
					break
				}
			}
			if !isSpecial {
				continue
			}
			if s, ok := apiCache.Get(safe.Handle); ok && s.YearsContributing > 0 {
				patches[safe.Handle] = s.YearsContributing
				continue
			}
			ghClient.EnrichCNCFYears(ctx, safe.Handle, apiCache)
			if s, ok := apiCache.Get(safe.Handle); ok && s.YearsContributing > 0 {
				patches[safe.Handle] = s.YearsContributing
			}
		}
		if len(patches) > 0 {
			log.Printf("backfilling years for %d special-category people", len(patches))
			if err := writer.PatchChangelog(outDir, patches); err != nil {
				log.Printf("warn: patch changelog years: %v", err)
			}
		}

		if err := apiCache.Save(); err != nil {
			log.Printf("warn: save api cache: %v", err)
		}
	}
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

// maintainerDataChanged returns true when the CSV-sourced fields of two
// SafeMaintainer records differ (name, company, maturity, or project set).
func maintainerDataChanged(a, b models.SafeMaintainer) bool {
	if a.Name != b.Name ||
		strings.TrimSpace(a.Company) != strings.TrimSpace(b.Company) ||
		strings.TrimSpace(a.Maturity) != strings.TrimSpace(b.Maturity) {
		return true
	}
	if len(a.Projects) != len(b.Projects) {
		return true
	}
	aSet := make(map[string]bool, len(a.Projects))
	for _, p := range a.Projects {
		aSet[p] = true
	}
	for _, p := range b.Projects {
		if !aSet[p] {
			return true
		}
	}
	return false
}

// compile-time assertion to keep fmt imported
var _ = fmt.Sprintf

