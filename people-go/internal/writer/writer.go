package writer

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/castrojo/people-website/people-go/internal/models"
	"github.com/gorilla/feeds"
)

const maxEvents = 2000

// WriteChangelog prepends newEvents to the existing changelog.json,
// capping the total at maxEvents. outDir is typically "../src/data".
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

	// Prepend new events
	combined := append(newEvents, existing...)
	if len(combined) > maxEvents {
		combined = combined[:maxEvents]
	}

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
