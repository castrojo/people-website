package differ

import (
	"fmt"
	"testing"
	"time"

	"github.com/castrojo/people-website/people-go/internal/models"
)

func TestCompute_NoChanges(t *testing.T) {
	person := models.RawPerson{Name: "Alice", Company: "Acme"}
	prev := map[string]models.RawPerson{"alice": person}
	curr := map[string]models.RawPerson{"alice": person}
	got := Compute(prev, curr, time.Now())
	if len(got) != 0 {
		t.Errorf("expected 0 events for no changes, got %d", len(got))
	}
}

func TestCompute_PersonAdded(t *testing.T) {
	prev := map[string]models.RawPerson{}
	curr := map[string]models.RawPerson{"alice": {Name: "Alice"}}
	got := Compute(prev, curr, time.Now())
	if len(got) != 1 {
		t.Fatalf("expected 1 event, got %d", len(got))
	}
	if got[0].Type != models.EventAdded {
		t.Errorf("expected EventAdded, got %q", got[0].Type)
	}
	if got[0].Person.Name != "Alice" {
		t.Errorf("expected person name Alice, got %q", got[0].Person.Name)
	}
}

func TestCompute_PersonRemoved(t *testing.T) {
	prev := map[string]models.RawPerson{"alice": {Name: "Alice"}}
	curr := map[string]models.RawPerson{}
	got := Compute(prev, curr, time.Now())
	if len(got) != 1 {
		t.Fatalf("expected 1 event, got %d", len(got))
	}
	if got[0].Type != models.EventRemoved {
		t.Errorf("expected EventRemoved, got %q", got[0].Type)
	}
	if got[0].Person.Name != "Alice" {
		t.Errorf("expected person name Alice, got %q", got[0].Person.Name)
	}
}

func TestCompute_PersonUpdated(t *testing.T) {
	prev := map[string]models.RawPerson{"alice": {Name: "Alice", Company: "Acme"}}
	curr := map[string]models.RawPerson{"alice": {Name: "Alice", Company: "NewCorp"}}
	got := Compute(prev, curr, time.Now())
	if len(got) != 1 {
		t.Fatalf("expected 1 event, got %d", len(got))
	}
	if got[0].Type != models.EventUpdated {
		t.Errorf("expected EventUpdated, got %q", got[0].Type)
	}
	if len(got[0].Changes) == 0 {
		t.Error("expected at least one field change for updated event")
	}
	found := false
	for _, ch := range got[0].Changes {
		if ch.Field == "Company" && ch.From == "Acme" && ch.To == "NewCorp" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected Company change Acme→NewCorp in %+v", got[0].Changes)
	}
}

// TestCompute_FirstRunCap verifies that when previous is empty and more than
// firstRunPeopleCap people are current, the result is capped to firstRunPeopleCap.
func TestCompute_FirstRunCap(t *testing.T) {
	const total = 6000
	curr := make(map[string]models.RawPerson, total)
	for i := 0; i < total; i++ {
		key := fmt.Sprintf("person%d", i)
		curr[key] = models.RawPerson{Name: key}
	}
	got := Compute(map[string]models.RawPerson{}, curr, time.Now())
	if len(got) > firstRunPeopleCap {
		t.Errorf("first-run cap: expected ≤%d events, got %d", firstRunPeopleCap, len(got))
	}
}

// TestCompute_FirstRunCap_NormalRun verifies that the cap does NOT apply when
// previous is non-empty (i.e. this is not a first run).
func TestCompute_FirstRunCap_NormalRun(t *testing.T) {
	const total = 100
	prev := map[string]models.RawPerson{"seed": {Name: "Seed"}}
	curr := make(map[string]models.RawPerson, total+1)
	curr["seed"] = models.RawPerson{Name: "Seed"}
	for i := 0; i < total; i++ {
		key := fmt.Sprintf("new%d", i)
		curr[key] = models.RawPerson{Name: key}
	}
	got := Compute(prev, curr, time.Now())
	// 100 added + no removed + no updated = 100 events; cap must NOT apply
	if len(got) != total {
		t.Errorf("non-first-run: expected %d events, got %d", total, len(got))
	}
}
