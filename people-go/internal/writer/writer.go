package writer

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/castrojo/people-website/people-go/internal/models"
	"github.com/gorilla/feeds"
)

// WriteChangelog prepends newEvents to the existing changelog.json.
// There is no cap — all events are retained so the full community is visible.
// outDir is typically "../src/data".
func WriteChangelog(outDir string, newEvents []models.Event) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	outPath := filepath.Join(outDir, "changelog.json")

	// Load existing events
	var existing []models.Event
	raw, err := os.ReadFile(outPath)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if raw != nil {
		if err := json.Unmarshal(raw, &existing); err != nil {
			existing = nil
		}
	}

	// Prepend new events — no size cap, retain full history
	combined := append(newEvents, existing...)

	data, err := json.MarshalIndent(combined, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(outPath, data, 0o644)
}

// WriteLandscapeLogos writes a normalized project-name → logo-URL map to
// outDir/landscape_logos.json for use by Astro at build time.
func WriteLandscapeLogos(outDir string, logos map[string]string) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(logos, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, "landscape_logos.json"), data, 0o644)
}

// PatchChangelog updates yearsContributing in existing changelog.json entries
// for any handle present in the patches map. Only updates entries where the
// value is currently 0 to avoid overwriting fresher event-level enrichment.
func PatchChangelog(outDir string, patches map[string]int) error {
	outPath := filepath.Join(outDir, "changelog.json")
	raw, err := os.ReadFile(outPath)
	if err != nil {
		return err
	}
	var events []models.Event
	if err := json.Unmarshal(raw, &events); err != nil {
		return err
	}
	changed := false
	for i, e := range events {
		if e.Person.Handle == "" || e.Person.YearsContributing > 0 {
			continue
		}
		if years, ok := patches[e.Person.Handle]; ok && years > 0 {
			events[i].Person.YearsContributing = years
			changed = true
		}
	}
	if !changed {
		return nil
	}
	data, err := json.MarshalIndent(events, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(outPath, data, 0o644)
}

// Stats holds aggregate community statistics derived from changelog.json.
type Stats struct {
	Total      int            `json:"total"`
	Added      int            `json:"added"`
	Removed    int            `json:"removed"`
	Updated    int            `json:"updated"`
	Countries  int            `json:"countries"`
	Companies  int            `json:"companies"`
	Categories map[string]int `json:"categories"`
}

// statsCategories defines the order in which categories are counted.
var statsCategories = []string{
	"Kubestronaut",
	"Golden-Kubestronaut",
	"Ambassadors",
	"Technical Oversight Committee",
	"End User TAB",
	"Governing Board",
	"Staff",
	"Marketing Committee",
}

// WriteStats reads changelog.json from outDir, deduplicates by github/name,
// computes aggregate stats, and writes stats.json to outDir.
func WriteStats(outDir string) error {
	changelogPath := filepath.Join(outDir, "changelog.json")
	raw, err := os.ReadFile(changelogPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}

	var events []models.Event
	if err := json.Unmarshal(raw, &events); err != nil {
		return fmt.Errorf("unmarshal changelog: %w", err)
	}

	// Deduplicate: first occurrence per key = most recent state (events are newest-first).
	seen := make(map[string]struct{})
	var people []models.SafePerson
	for _, e := range events {
		key := e.Person.GitHub
		if key == "" {
			key = e.Person.Name
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		// Only count people who haven't been removed as their most recent event.
		if e.Type != models.EventRemoved {
			people = append(people, e.Person)
		}
	}

	// Count raw event types (not deduplicated).
	var added, removed, updated int
	for _, e := range events {
		switch e.Type {
		case models.EventAdded:
			added++
		case models.EventRemoved:
			removed++
		case models.EventUpdated:
			updated++
		}
	}

	// Countries: last segment of location after splitting on ",".
	countrySet := make(map[string]struct{})
	for _, p := range people {
		if p.Location == "" {
			continue
		}
		parts := strings.Split(p.Location, ",")
		country := strings.TrimSpace(parts[len(parts)-1])
		if country != "" {
			countrySet[country] = struct{}{}
		}
	}

	// Companies: non-empty company values.
	companySet := make(map[string]struct{})
	for _, p := range people {
		if p.Company != "" {
			companySet[p.Company] = struct{}{}
		}
	}

	// Category counts.
	cats := make(map[string]int, len(statsCategories))
	for _, cat := range statsCategories {
		for _, p := range people {
			for _, c := range p.Category {
				if c == cat {
					cats[cat]++
					break
				}
			}
		}
	}

	stats := Stats{
		Total:      len(people),
		Added:      added,
		Removed:    removed,
		Updated:    updated,
		Countries:  len(countrySet),
		Companies:  len(companySet),
		Categories: cats,
	}

	data, err := json.MarshalIndent(stats, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, "stats.json"), data, 0o644)
}

// WriteRSS generates an RSS feed from events and writes it to outDir/feed.xml.
func WriteRSS(outDir string, events []models.Event) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}

	feed := &feeds.Feed{
		Title:       "CNCF People",
		Link:        &feeds.Link{Href: "https://castrojo.github.io/people-website/"},
		Description: "Activity feed — who's joining the cloud native community",
		Author:      &feeds.Author{Name: "CNCF People"},
		Created:     time.Now(),
	}

	for _, e := range events {
		title := fmt.Sprintf("%s %s", e.Type, e.Person.Name)
		link := e.Person.GitHub
		if link == "" {
			link = "https://github.com"
		}
		feed.Items = append(feed.Items, &feeds.Item{
			Id:      e.ID,
			Title:   title,
			Link:    &feeds.Link{Href: link},
			Created: e.Timestamp,
		})
	}

	rss, err := feed.ToRss()
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, "feed.xml"), []byte(rss), 0o644)
}
