package differ

import (
	"fmt"
	"reflect"
	"time"

	"github.com/castrojo/people-website/people-go/internal/models"
	"github.com/google/uuid"
)

const firstRunCap = 5000

// Compute returns the list of events representing the delta between
// previous and current people maps. On first run (previous is empty),
// events are capped at firstRunCap newest entries by insertion order.
func Compute(previous, current map[string]models.RawPerson, now time.Time) []models.Event {
	var events []models.Event

	// Added: in current but not in previous
	added := []models.Event{}
	for handle, person := range current {
		if _, exists := previous[handle]; !exists {
			added = append(added, models.Event{
				ID:        uuid.New().String(),
				Type:      models.EventAdded,
				Timestamp: now,
				Person:    person.ToSafe(),
			})
		}
	}

	// Cap first-run flood
	if len(previous) == 0 && len(added) > firstRunCap {
		added = added[:firstRunCap]
	}
	events = append(events, added...)

	// Removed: in previous but not in current
	for handle, person := range previous {
		if _, exists := current[handle]; !exists {
			events = append(events, models.Event{
				ID:        uuid.New().String(),
				Type:      models.EventRemoved,
				Timestamp: now,
				Person:    person.ToSafe(),
			})
		}
	}

	// Updated: in both, but safe fields changed
	for handle, newPerson := range current {
		oldPerson, exists := previous[handle]
		if !exists {
			continue
		}
		changes := diffPersons(oldPerson, newPerson)
		if len(changes) > 0 {
			events = append(events, models.Event{
				ID:        uuid.New().String(),
				Type:      models.EventUpdated,
				Timestamp: now,
				Person:    newPerson.ToSafe(),
				Changes:   changes,
			})
		}
	}

	return events
}

// safeFields lists the RawPerson fields we track for changes (excludes email/wechat/sensitive).
var safeFields = []string{"Name", "Company", "Location", "LinkedIn", "Twitter", "GitHub", "Image", "Bluesky", "Website"}

func diffPersons(old, new models.RawPerson) []models.FieldChange {
	oldVal := reflect.ValueOf(old)
	newVal := reflect.ValueOf(new)

	var changes []models.FieldChange
	for _, field := range safeFields {
		oldF := fmt.Sprintf("%v", oldVal.FieldByName(field).Interface())
		newF := fmt.Sprintf("%v", newVal.FieldByName(field).Interface())
		if oldF != newF {
			changes = append(changes, models.FieldChange{
				Field: field,
				From:  oldF,
				To:    newF,
			})
		}
	}
	return changes
}
