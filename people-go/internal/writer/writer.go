package writer

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/castrojo/people-website/people-go/internal/apicache"
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

// BackfillPersonFields patches existing changelog.json events that are missing
// countryFlag or primaryBadge — fields added after the initial data was written.
// Safe to call on every run; skips events that already have both fields set.
func BackfillPersonFields(outDir string) error {
	outPath := filepath.Join(outDir, "changelog.json")
	raw, err := os.ReadFile(outPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	var events []models.Event
	if err := json.Unmarshal(raw, &events); err != nil {
		return err
	}
	changed := false
	for i, e := range events {
		p := &events[i].Person
		if p.CountryFlag == "" && e.Person.Location != "" {
			p.CountryFlag = models.CountryFlag(e.Person.Location)
			if p.CountryFlag != "" {
				changed = true
			}
		}
		if p.PrimaryBadge == "" && len(e.Person.Category) > 0 {
			p.PrimaryBadge = models.PrimaryBadge(e.Person.Category)
			if p.PrimaryBadge != "" {
				changed = true
			}
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

// WriteMaintainers writes the deduplicated maintainer list to outDir/maintainers.json,
// sorted by UpdatedAt descending so the most recently changed entries appear first.
func WriteMaintainers(outDir string, maintainers []models.SafeMaintainer) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	sort.Slice(maintainers, func(i, j int) bool {
		return maintainers[i].UpdatedAt.After(maintainers[j].UpdatedAt)
	})
	data, err := json.MarshalIndent(maintainers, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, "maintainers.json"), data, 0o644)
}

// LoadMaintainers reads the existing maintainers.json from disk.
// Returns an empty slice (not an error) if the file does not exist.
func LoadMaintainers(outDir string) ([]models.SafeMaintainer, error) {
	path := filepath.Join(outDir, "maintainers.json")
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var m []models.SafeMaintainer
	return m, json.Unmarshal(data, &m)
}

// WriteChangelogPages splits changelog events into fixed-size pages for lazy frontend loading.
// Writes changelog-{n}.json (0-indexed) plus changelog-meta.json with counts.
func WriteChangelogPages(outDir string, events []models.Event) error {
	const pageSize = 500
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	totalPages := (len(events) + pageSize - 1) / pageSize
	if totalPages == 0 {
		totalPages = 1
	}
	for page := 0; page < totalPages; page++ {
		start := page * pageSize
		end := start + pageSize
		if end > len(events) {
			end = len(events)
		}
		pageEvents := events[start:end]
		data, err := json.MarshalIndent(pageEvents, "", "  ")
		if err != nil {
			return fmt.Errorf("marshal changelog page %d: %w", page, err)
		}
		path := filepath.Join(outDir, fmt.Sprintf("changelog-%d.json", page))
		if err := os.WriteFile(path, data, 0o644); err != nil {
			return err
		}
	}
	meta := map[string]int{
		"totalEvents": len(events),
		"totalPages":  totalPages,
		"pageSize":    pageSize,
	}
	metaData, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, "changelog-meta.json"), metaData, 0o644)
}

// WritePeopleIndex writes a deduplicated snapshot of the current community to people-index.json.
// One entry per unique person (by GitHub URL or name), latest state only, removed people excluded.
// Regenerated on every run.
func WritePeopleIndex(outDir string, events []models.Event) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
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
		if e.Type != models.EventRemoved {
			people = append(people, e.Person)
		}
	}
	data, err := json.MarshalIndent(people, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, "people-index.json"), data, 0o644)
}

// LeadershipEntry is the output format for toc.json, tab.json, gb.json, and marketing.json.
type LeadershipEntry struct {
	Handle string `json:"handle"`
	Name   string `json:"name"`
	Title  string `json:"title"`
}

// leadershipSortKey returns a numeric priority so Chair sorts before Vice Chair,
// and both sort before all other titles.
func leadershipSortKey(title string) int {
	lower := strings.ToLower(title)
	switch {
	case strings.HasPrefix(lower, "chair"):
		return 0
	case strings.HasPrefix(lower, "vice"):
		return 1
	default:
		return 2
	}
}

// writeLeadershipJSON is the shared implementation for WriteTOC/WriteTAB/WriteGB/WriteMarketing.
// It filters people by category, maps the role via roleFunc (empty → "Member"), sorts, and writes.
func writeLeadershipJSON(outDir, filename, category string, people []models.RawPerson, roleFunc func(models.RawPerson) string) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	var entries []LeadershipEntry
	for _, p := range people {
		hasCat := false
		for _, c := range p.Category {
			if c == category {
				hasCat = true
				break
			}
		}
		if !hasCat {
			continue
		}
		handle := p.GitHubHandle()
		if handle == "" {
			log.Printf("warn: %s member %q has no GitHub handle", category, p.Name)
		}
		title := roleFunc(p)
		if title == "" {
			title = "Member"
		}
		entries = append(entries, LeadershipEntry{
			Handle: handle,
			Name:   p.Name,
			Title:  title,
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		ki, kj := leadershipSortKey(entries[i].Title), leadershipSortKey(entries[j].Title)
		if ki != kj {
			return ki < kj
		}
		return entries[i].Name < entries[j].Name
	})
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, filename), data, 0o644)
}

// WriteTOC generates toc.json from people in the "Technical Oversight Committee" category.
func WriteTOC(outDir string, people []models.RawPerson) error {
	return writeLeadershipJSON(outDir, "toc.json", "Technical Oversight Committee", people,
		func(p models.RawPerson) string { return p.TOCRole })
}

// WriteTAB generates tab.json from people in the "End User TAB" category.
func WriteTAB(outDir string, people []models.RawPerson) error {
	return writeLeadershipJSON(outDir, "tab.json", "End User TAB", people,
		func(p models.RawPerson) string { return p.TABRole })
}

// WriteGB generates gb.json from people in the "Governing Board" category.
func WriteGB(outDir string, people []models.RawPerson) error {
	return writeLeadershipJSON(outDir, "gb.json", "Governing Board", people,
		func(p models.RawPerson) string { return p.GBRole })
}

// WriteMarketing generates marketing.json from people in the "Marketing Committee" category.
// Marketing Committee has no dedicated role field — all members get "Member".
func WriteMarketing(outDir string, people []models.RawPerson) error {
	return writeLeadershipJSON(outDir, "marketing.json", "Marketing Committee", people,
		func(p models.RawPerson) string { return "" })
}

// EmeritusEntry records a former CNCF community member.
type EmeritusEntry struct {
	Handle      string   `json:"handle"`
	Name        string   `json:"name"`
	Category    []string `json:"category"`
	RemovedDate string   `json:"removedDate"`
}

// WriteEmeritusFromEvents appends newly removed people to people-emeritus.json.
// It reads the existing file (treating a missing file as an empty list), deduplicates
// by handle, skips anyone still present in activeHandles, and writes back.
func WriteEmeritusFromEvents(outDir string, removed []models.Event, activeHandles map[string]bool) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	outPath := filepath.Join(outDir, "people-emeritus.json")

	var existing []EmeritusEntry
	if raw, err := os.ReadFile(outPath); err == nil {
		_ = json.Unmarshal(raw, &existing)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}

	seen := make(map[string]bool, len(existing))
	for _, e := range existing {
		if e.Handle != "" {
			seen[e.Handle] = true
		}
	}

	for _, ev := range removed {
		if ev.Type != models.EventRemoved {
			continue
		}
		handle := ev.Person.Handle
		if handle == "" || activeHandles[handle] || seen[handle] {
			continue
		}
		seen[handle] = true
		existing = append(existing, EmeritusEntry{
			Handle:      handle,
			Name:        ev.Person.Name,
			Category:    ev.Person.Category,
			RemovedDate: ev.Timestamp.Format("2006-01-02"),
		})
	}

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(outPath, data, 0o644)
}

// HeroRotations is the output structure written to heroes.json.
type HeroRotations struct {
	GeneratedAt         time.Time               `json:"generatedAt"`
	Everyone            []models.SafePerson     `json:"everyone"`
	Ambassadors         []models.SafePerson     `json:"ambassadors"`
	Kubestronauts       []models.SafePerson     `json:"kubestronauts"`
	GoldenKubestronauts []models.SafePerson     `json:"goldenKubestronauts"`
	Maintainers         []models.SafeMaintainer `json:"maintainers"`
	CNCFLeadership      []models.SafePerson     `json:"cncfLeadership"`
	Emeritus            []models.SafePerson     `json:"emeritus"`
}

// dailyPick selects n items from the slice using a deterministic daily rotation.
// It shuffles the slice using today's UTC date as the random seed, then picks
// n items starting at cursor = (dayOfYear * n) % len(items).
// This ensures the same 4 people show all day, and the full list cycles before repeating.
func dailyPick[T any](items []T, n int) []T {
	if len(items) == 0 {
		return []T{}
	}
	if n >= len(items) {
		result := make([]T, len(items))
		copy(result, items)
		return result
	}
	now := time.Now().UTC()
	seed := int64(now.Year()*10000 + int(now.Month())*100 + now.Day())
	r := rand.New(rand.NewSource(seed))
	shuffled := make([]T, len(items))
	copy(shuffled, items)
	r.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
	cursor := (now.YearDay() * n) % len(shuffled)
	result := make([]T, 0, n)
	for len(result) < n {
		result = append(result, shuffled[cursor%len(shuffled)])
		cursor++
	}
	return result
}

// isSheHerTheyThem returns true when the person's pronouns indicate she/her or they/them.
// Uses a simple substring match so variants like "she/they" or "they/them" both match.
func isSheHerTheyThem(p models.SafePerson) bool {
	pr := strings.ToLower(strings.TrimSpace(p.Pronouns))
	return strings.Contains(pr, "she") || strings.Contains(pr, "they")
}

// dailyPickDiverse picks n SafePersons, guaranteeing ≥1 she/her or they/them person
// when the pool contains any. It partitions the pool into two mutually exclusive
// buckets, picks 1 from the diverse bucket (using the same date seed for determinism),
// then picks n-1 from the rest. If rest has fewer than n-1 people it overflows into the
// remaining diverse pool. Falls back to dailyPick when no qualifying people exist or n≤1.
func dailyPickDiverse(items []models.SafePerson, n int) []models.SafePerson {
	if len(items) == 0 || n == 0 {
		return []models.SafePerson{}
	}

	var diverse, rest []models.SafePerson
	for _, p := range items {
		if isSheHerTheyThem(p) {
			diverse = append(diverse, p)
		} else {
			rest = append(rest, p)
		}
	}

	// No qualifying people or trivial pick — use standard rotation
	if len(diverse) == 0 || n <= 1 {
		return dailyPick(items, n)
	}

	// Slot 0: one person from the diverse bucket (guaranteed)
	result := dailyPick(diverse, 1)
	picked := result[0]

	// Slots 1..n-1: fill from rest, then overflow into remaining diverse
	remaining := make([]models.SafePerson, 0, len(rest)+len(diverse)-1)
	remaining = append(remaining, rest...)
	for _, p := range diverse {
		if p.Handle != picked.Handle || p.Name != picked.Name {
			remaining = append(remaining, p)
		}
	}
	result = append(result, dailyPick(remaining, n-1)...)
	return result
}

// WriteHeroRotations writes the daily hero rotation to heroes.json.
// leadershipHandles is a slice of GitHub handles for the fixed CNCF Leadership section.
func WriteHeroRotations(outDir string, events []models.Event, maintainers []models.SafeMaintainer, leadershipHandles []string) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}

	// Build per-category pools from deduplicated people index.
	seen := make(map[string]struct{})
	var allPeople []models.SafePerson
	pools := map[string][]models.SafePerson{
		"Ambassadors":         {},
		"Kubestronaut":        {},
		"Golden-Kubestronaut": {},
	}
	// Also build a lookup by handle for leadership resolution.
	byHandle := map[string]models.SafePerson{}

	for _, e := range events {
		if e.Type == models.EventRemoved {
			continue
		}
		key := e.Person.GitHub
		if key == "" {
			key = e.Person.Name
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		allPeople = append(allPeople, e.Person)
		if e.Person.Handle != "" {
			byHandle[e.Person.Handle] = e.Person
		}
		for _, cat := range e.Person.Category {
			if _, ok := pools[cat]; ok {
				pools[cat] = append(pools[cat], e.Person)
			}
		}
	}

	// Resolve CNCF Leadership from handles.
	leadership := []models.SafePerson{}
	for _, h := range leadershipHandles {
		if p, ok := byHandle[h]; ok {
			leadership = append(leadership, p)
		}
	}

	// Build emeritus pool from people-emeritus.json (empty slice if file absent).
	var emeritusPeople []models.SafePerson
	if raw, err := os.ReadFile(filepath.Join(outDir, "people-emeritus.json")); err == nil {
		var entries []EmeritusEntry
		if json.Unmarshal(raw, &entries) == nil {
			for _, e := range entries {
				if e.Handle == "" {
					continue
				}
				emeritusPeople = append(emeritusPeople, models.SafePerson{
					Name:     e.Name,
					Handle:   e.Handle,
					Category: e.Category,
				})
			}
		}
	}

	rotations := HeroRotations{
		GeneratedAt:         time.Now().UTC(),
		Everyone:            dailyPickDiverse(allPeople, 8),
		Ambassadors:         dailyPickDiverse(pools["Ambassadors"], 8),
		Kubestronauts:       dailyPickDiverse(pools["Kubestronaut"], 4),
		GoldenKubestronauts: dailyPickDiverse(pools["Golden-Kubestronaut"], 4),
		Maintainers:         dailyPick(maintainers, 8),
		CNCFLeadership:      leadership,
		Emeritus:            dailyPickDiverse(emeritusPeople, 8),
	}

	data, err := json.MarshalIndent(rotations, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, "heroes.json"), data, 0o644)
}

// StaffAssignment is a single entry in staff-assignments.json.
type StaffAssignment struct {
	Handle     string `json:"handle,omitempty"`
	Name       string `json:"name,omitempty"`
	ImageURL   string `json:"imageUrl,omitempty"`
	ProfileURL string `json:"profileUrl,omitempty"`
}

// StaffSupportEntry is the enriched output written to staff-support.json.
type StaffSupportEntry struct {
	Handle     string `json:"handle,omitempty"`
	Name       string `json:"name"`
	ImageURL   string `json:"imageUrl,omitempty"`
	ProfileURL string `json:"profileUrl,omitempty"`
}

// WriteStaffSupport reads src/data/staff-assignments.json, enriches each handle
// with the canonical name and image URL from cncf/people, and writes
// src/data/staff-support.json. If staff-assignments.json is absent the function
// logs a warning and returns nil (graceful no-op for first-run bootstraps).
func WriteStaffSupport(outDir string, people []models.RawPerson) error {
	assignPath := filepath.Join(outDir, "staff-assignments.json")
	raw, err := os.ReadFile(assignPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			log.Printf("warn: WriteStaffSupport: %s not found — skipping", assignPath)
			return nil
		}
		return err
	}

	var assignments map[string][]StaffAssignment
	if err := json.Unmarshal(raw, &assignments); err != nil {
		return fmt.Errorf("parse staff-assignments.json: %w", err)
	}

	// Build lookup: lowercase GitHub handle → RawPerson
	byHandle := make(map[string]models.RawPerson, len(people))
	for _, p := range people {
		if h := p.GitHubHandle(); h != "" {
			byHandle[strings.ToLower(h)] = p
		}
	}

	result := make(map[string][]StaffSupportEntry, len(assignments))
	for tab, entries := range assignments {
		out := make([]StaffSupportEntry, 0, len(entries))
		for _, entry := range entries {
			if entry.Handle != "" {
				p, found := byHandle[strings.ToLower(entry.Handle)]
				var name, imageURL string
				if found {
					name = p.Name
					imageURL = p.ImageURL()
				} else {
					name = entry.Handle
				}
				out = append(out, StaffSupportEntry{
					Handle:   entry.Handle,
					Name:     name,
					ImageURL: imageURL,
				})
			} else {
				// No-handle entry (imageUrl/profileUrl staff): pass through as-is.
				out = append(out, StaffSupportEntry{
					Name:       entry.Name,
					ImageURL:   entry.ImageURL,
					ProfileURL: entry.ProfileURL,
				})
			}
		}
		result[tab] = out
	}

	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(outDir, "staff-support.json"), data, 0o644)
}

// BackfillFromCache patches Pronouns, Location, and YearsContributing into changelog.json
// events that are missing them, using data from the GitHub API cache. Only updates fields
// that are currently empty/zero. Does not perform new API fetches — caller is responsible
// for pre-populating the cache.
func BackfillFromCache(outDir string, cache *apicache.Cache) error {
	outPath := filepath.Join(outDir, "changelog.json")
	raw, err := os.ReadFile(outPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	var events []models.Event
	if err := json.Unmarshal(raw, &events); err != nil {
		return err
	}
	changed := false
	for i, e := range events {
		if e.Person.Handle == "" {
			continue
		}
		stats, ok := cache.Get(e.Person.Handle)
		if !ok {
			continue
		}
		p := &events[i].Person
		// Derive avatarUrl from handle if not already set (free — no API call needed).
		if p.AvatarURL == "" && p.Handle != "" {
			p.AvatarURL = "https://avatars.githubusercontent.com/" + p.Handle
			changed = true
		}
		if p.Pronouns == "" && stats.Pronouns != "" {
			p.Pronouns = stats.Pronouns
			changed = true
		}
		if p.Location == "" && stats.Location != "" {
			p.Location = stats.Location
			p.CountryFlag = models.CountryFlag(stats.Location)
			changed = true
		}
		if p.YearsContributing == 0 && stats.YearsContributing > 0 {
			p.YearsContributing = stats.YearsContributing
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
