package state

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/castrojo/people-website/people-go/internal/models"
)

const (
	stateFile   = "state.json"
	previousFile = "previous_people.json"
)

// State tracks the last processed commit SHA and when the sync ran.
type State struct {
	LastSHA   string    `json:"lastSha"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Manager handles loading and saving sync state to cacheDir.
type Manager struct {
	cacheDir string
}

// New creates a Manager rooted at cacheDir (created if absent).
func New(cacheDir string) (*Manager, error) {
	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return nil, err
	}
	return &Manager{cacheDir: cacheDir}, nil
}

// LoadState reads the cached state. Returns a zero State if not found.
func (m *Manager) LoadState() (State, error) {
	var s State
	data, err := os.ReadFile(filepath.Join(m.cacheDir, stateFile))
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	return s, json.Unmarshal(data, &s)
}

// SaveState writes the state to cache.
func (m *Manager) SaveState(s State) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(m.cacheDir, stateFile), data, 0o644)
}

// LoadPrevious reads the previous people map from cache.
// Returns an empty map if not found.
func (m *Manager) LoadPrevious() (map[string]models.RawPerson, error) {
	result := make(map[string]models.RawPerson)
	data, err := os.ReadFile(filepath.Join(m.cacheDir, previousFile))
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	return result, json.Unmarshal(data, &result)
}

// SavePrevious writes the current people map to cache for the next run.
func (m *Manager) SavePrevious(people map[string]models.RawPerson) error {
	data, err := json.MarshalIndent(people, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(m.cacheDir, previousFile), data, 0o644)
}
