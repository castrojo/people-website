package models

import "time"

// EventType describes what happened to a person in the community.
type EventType string

const (
	EventAdded   EventType = "added"
	EventRemoved EventType = "removed"
	EventUpdated EventType = "updated"
)

// FieldChange records a single changed field for "updated" events.
type FieldChange struct {
	Field string `json:"field"`
	From  string `json:"from"`
	To    string `json:"to"`
}

// Event is a single changelog entry written to changelog.json.
type Event struct {
	ID        string       `json:"id"`
	Type      EventType    `json:"type"`
	Timestamp time.Time    `json:"timestamp"`
	Person    SafePerson   `json:"person"`
	Changes   []FieldChange `json:"changes,omitempty"`
}
