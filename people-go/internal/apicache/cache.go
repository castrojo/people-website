package apicache

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

const (
	cacheFile = "api_cache.json"
	ttl       = 7 * 24 * time.Hour
)

// UserStats holds enrichment data fetched from the GitHub API.
type UserStats struct {
	AvatarURL         string    `json:"avatarUrl"`
	Contributions     int       `json:"contributions"`
	PublicRepos       int       `json:"publicRepos"`
	YearsContributing int       `json:"yearsContributing"`
	FetchedAt         time.Time `json:"fetchedAt"`
}

// Cache stores per-user API results with a TTL to avoid re-fetching.
type Cache struct {
	path  string
	data  map[string]UserStats
	dirty bool
}

// Load reads the cache from disk. Returns an empty cache if not found.
func Load(cacheDir string) (*Cache, error) {
	path := filepath.Join(cacheDir, cacheFile)
	c := &Cache{path: path, data: make(map[string]UserStats)}

	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return c, nil
	}
	if err != nil {
		return c, err
	}
	return c, json.Unmarshal(raw, &c.data)
}

// Get returns cached stats for a handle if present and not expired.
func (c *Cache) Get(handle string) (UserStats, bool) {
	s, ok := c.data[handle]
	if !ok || time.Since(s.FetchedAt) > ttl {
		return UserStats{}, false
	}
	return s, true
}

// Set stores stats for a handle and marks the cache dirty.
func (c *Cache) Set(handle string, s UserStats) {
	s.FetchedAt = time.Now()
	c.data[handle] = s
	c.dirty = true
}

// Save writes the cache to disk only if it was modified.
func (c *Cache) Save() error {
	if !c.dirty {
		return nil
	}
	data, err := json.MarshalIndent(c.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(c.path, data, 0o644)
}
