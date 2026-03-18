package writer

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/castrojo/people-website/people-go/internal/models"
)

// makePerson is a helper to build a minimal SafePerson for tests.
func makePerson(name, handle string, categories []string, pronouns string) models.SafePerson {
	return models.SafePerson{
		Name:     name,
		Handle:   handle,
		Category: categories,
		Pronouns: pronouns,
	}
}

// makeMaintainer is a helper to build a minimal SafeMaintainer for tests.
func makeMaintainer(name, handle string) models.SafeMaintainer {
	return models.SafeMaintainer{
		Name:   name,
		Handle: handle,
	}
}

// TestCategoryBalancedPick_MixedCategories verifies that the Everyone rotation
// contains people from all three source categories when all pools are large enough.
func TestCategoryBalancedPick_MixedCategories(t *testing.T) {
	ambassadors := make([]models.SafePerson, 10)
	for i := range ambassadors {
		ambassadors[i] = makePerson("Ambassador"+string(rune('A'+i)), "amb"+string(rune('a'+i)), []string{"Ambassadors"}, "")
	}
	kubestronauts := make([]models.SafePerson, 20)
	for i := range kubestronauts {
		kubestronauts[i] = makePerson("Kube"+string(rune('A'+i)), "kube"+string(rune('a'+i)), []string{"Kubestronaut"}, "")
	}
	maintainers := make([]models.SafeMaintainer, 10)
	for i := range maintainers {
		maintainers[i] = makeMaintainer("Maintainer"+string(rune('A'+i)), "maint"+string(rune('a'+i)))
	}

	result := categoryBalancedPick(ambassadors, kubestronauts, maintainers, 8)

	if len(result) != 8 {
		t.Fatalf("expected 8 results, got %d", len(result))
	}

	// Verify at least one Ambassador is present
	ambassadorFound := false
	for _, p := range result {
		for _, cat := range p.Category {
			if cat == "Ambassadors" {
				ambassadorFound = true
			}
		}
	}
	if !ambassadorFound {
		t.Error("expected at least one Ambassador in Everyone rotation, found none")
	}

	// Verify at least one Kubestronaut is present
	kubeFound := false
	for _, p := range result {
		for _, cat := range p.Category {
			if cat == "Kubestronaut" {
				kubeFound = true
			}
		}
	}
	if !kubeFound {
		t.Error("expected at least one Kubestronaut in Everyone rotation, found none")
	}

	// Verify at least one Maintainer is present (maintainers have no Category set,
	// but categoryBalancedPick tags them with "Maintainer" for identification)
	maintainerFound := false
	for _, p := range result {
		for _, cat := range p.Category {
			if cat == "Maintainer" {
				maintainerFound = true
			}
		}
	}
	if !maintainerFound {
		t.Error("expected at least one Maintainer in Everyone rotation, found none")
	}
}

// TestCategoryBalancedPick_EmptyMaintainers verifies graceful fallback when
// the maintainer pool is empty — result should still include ambassadors + kubestronauts.
func TestCategoryBalancedPick_EmptyMaintainers(t *testing.T) {
	ambassadors := make([]models.SafePerson, 5)
	for i := range ambassadors {
		ambassadors[i] = makePerson("Ambassador"+string(rune('A'+i)), "amb"+string(rune('a'+i)), []string{"Ambassadors"}, "")
	}
	kubestronauts := make([]models.SafePerson, 5)
	for i := range kubestronauts {
		kubestronauts[i] = makePerson("Kube"+string(rune('A'+i)), "kube"+string(rune('a'+i)), []string{"Kubestronaut"}, "")
	}

	result := categoryBalancedPick(ambassadors, kubestronauts, nil, 8)

	if len(result) == 0 {
		t.Fatal("expected non-empty result even with no maintainers")
	}
	if len(result) > 8 {
		t.Errorf("expected at most 8 results, got %d", len(result))
	}
}

// TestCategoryBalancedPick_NoDuplicates verifies that a person appearing in both
// Ambassadors and Kubestronaut pools is not picked twice.
func TestCategoryBalancedPick_NoDuplicates(t *testing.T) {
	// Alice is in both pools
	alice := makePerson("Alice", "alice", []string{"Ambassadors", "Kubestronaut"}, "she/her")
	ambassadors := []models.SafePerson{alice}
	for i := 0; i < 5; i++ {
		ambassadors = append(ambassadors, makePerson("Amb"+string(rune('B'+i)), "amb"+string(rune('b'+i)), []string{"Ambassadors"}, ""))
	}
	kubestronauts := []models.SafePerson{alice}
	for i := 0; i < 15; i++ {
		kubestronauts = append(kubestronauts, makePerson("Kube"+string(rune('A'+i)), "kube"+string(rune('a'+i)), []string{"Kubestronaut"}, ""))
	}
	maintainers := make([]models.SafeMaintainer, 5)
	for i := range maintainers {
		maintainers[i] = makeMaintainer("Maint"+string(rune('A'+i)), "maint"+string(rune('a'+i)))
	}

	result := categoryBalancedPick(ambassadors, kubestronauts, maintainers, 8)

	seen := make(map[string]int)
	for _, p := range result {
		seen[p.Handle]++
	}
	for handle, count := range seen {
		if count > 1 {
			t.Errorf("handle %q appears %d times in result (expected 1)", handle, count)
		}
	}
}

// TestCategoryBalancedPick_MaintainerAvatarURL verifies that when a SafeMaintainer
// with a known handle is converted to SafePerson for the Everyone rotation,
// the resulting SafePerson carries a populated AvatarURL (GitHub CDN URL).
func TestCategoryBalancedPick_MaintainerAvatarURL(t *testing.T) {
	maintainers := []models.SafeMaintainer{
		{Name: "Ana Tester", Handle: "anatester", AvatarURL: "https://avatars.githubusercontent.com/anatester"},
	}

	result := categoryBalancedPick(nil, nil, maintainers, 8)

	if len(result) == 0 {
		t.Fatal("expected at least one result for a single maintainer")
	}
	got := result[0]
	if got.AvatarURL != "https://avatars.githubusercontent.com/anatester" {
		t.Errorf("AvatarURL = %q; want %q", got.AvatarURL, "https://avatars.githubusercontent.com/anatester")
	}
	if got.Handle != "anatester" {
		t.Errorf("Handle = %q; want %q", got.Handle, "anatester")
	}
}

// TestCategoryBalancedPick_DiversityGuaranteed verifies that when she/her or they/them
// people exist in the pools, at least one appears in the result.
func TestCategoryBalancedPick_DiversityGuaranteed(t *testing.T) {
	// Only one she/her person across all ambassador slots
	ambassadors := []models.SafePerson{
		makePerson("Alice", "alice", []string{"Ambassadors"}, "she/her"),
		makePerson("Bob", "bob", []string{"Ambassadors"}, ""),
		makePerson("Charlie", "charlie", []string{"Ambassadors"}, ""),
		makePerson("Dave", "dave", []string{"Ambassadors"}, ""),
		makePerson("Eve", "eve", []string{"Ambassadors"}, ""),
	}
	kubestronauts := make([]models.SafePerson, 20)
	for i := range kubestronauts {
		kubestronauts[i] = makePerson("Kube"+string(rune('A'+i)), "kube"+string(rune('a'+i)), []string{"Kubestronaut"}, "")
	}
	maintainers := make([]models.SafeMaintainer, 5)
	for i := range maintainers {
		maintainers[i] = makeMaintainer("Maint"+string(rune('A'+i)), "maint"+string(rune('a'+i)))
	}

	result := categoryBalancedPick(ambassadors, kubestronauts, maintainers, 8)

	diverseFound := false
	for _, p := range result {
		if isSheHerTheyThem(p) {
			diverseFound = true
			break
		}
	}
	if !diverseFound {
		t.Error("expected at least one she/her or they/them person in balanced pick when pool contains one")
	}
}

// makeRawPerson builds a minimal RawPerson for testing leadership writers.
func makeRawPerson(name, github string, categories []string, gbRole, tocRole, tabRole string) models.RawPerson {
	return models.RawPerson{
		Name:     name,
		GitHub:   github,
		Category: categories,
		GBRole:   gbRole,
		TOCRole:  tocRole,
		TABRole:  tabRole,
	}
}

func TestWriteLeadershipRoles_WritesAllSections(t *testing.T) {
	dir := t.TempDir()
	orig, _ := os.Getwd()
	_ = os.Chdir(dir)
	t.Cleanup(func() { _ = os.Chdir(orig) })

	people := []models.RawPerson{
		makeRawPerson("Alice Chair", "alicechair", []string{"Technical Oversight Committee"}, "", "Chair", ""),
		makeRawPerson("Bob Member", "bobmember", []string{"End User TAB"}, "", "", "Member"),
		makeRawPerson("Carol GB", "carolgb", []string{"Governing Board"}, "Vice Chair", "", ""),
		makeRawPerson("Dana Marketing", "danamarketing", []string{"Marketing Committee"}, "", "", ""),
	}

	if err := WriteLeadershipRoles(dir, people); err != nil {
		t.Fatalf("WriteLeadershipRoles: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(dir, "leadership-roles.json"))
	if err != nil {
		t.Fatalf("leadership-roles.json not created: %v", err)
	}

	var roles LeadershipRoles
	if err := json.Unmarshal(data, &roles); err != nil {
		t.Fatalf("unmarshal leadership-roles.json: %v", err)
	}

	if len(roles.TOC) != 1 || roles.TOC[0].Name != "Alice Chair" {
		t.Errorf("TOC: expected Alice Chair, got %v", roles.TOC)
	}
	if len(roles.TAB) != 1 || roles.TAB[0].Name != "Bob Member" {
		t.Errorf("TAB: expected Bob Member, got %v", roles.TAB)
	}
	if len(roles.GB) != 1 || roles.GB[0].Name != "Carol GB" {
		t.Errorf("GB: expected Carol GB, got %v", roles.GB)
	}
	if len(roles.Marketing) != 1 || roles.Marketing[0].Name != "Dana Marketing" {
		t.Errorf("Marketing: expected Dana Marketing, got %v", roles.Marketing)
	}
}

func TestWriteLeadershipRoles_SortsByRole(t *testing.T) {
	dir := t.TempDir()
	orig, _ := os.Getwd()
	_ = os.Chdir(dir)
	t.Cleanup(func() { _ = os.Chdir(orig) })

	people := []models.RawPerson{
		makeRawPerson("Zara Member", "zaramember", []string{"Technical Oversight Committee"}, "", "Member", ""),
		makeRawPerson("Aaron Chair", "aaronchair", []string{"Technical Oversight Committee"}, "", "Chair", ""),
	}

	if err := WriteLeadershipRoles(dir, people); err != nil {
		t.Fatalf("WriteLeadershipRoles: %v", err)
	}

	data, _ := os.ReadFile(filepath.Join(dir, "leadership-roles.json"))
	var roles LeadershipRoles
	json.Unmarshal(data, &roles) //nolint:errcheck

	if len(roles.TOC) < 2 {
		t.Fatalf("expected 2 TOC entries, got %d", len(roles.TOC))
	}
	if roles.TOC[0].Name != "Aaron Chair" {
		t.Errorf("expected Chair to sort first, got %q", roles.TOC[0].Name)
	}
}

func TestWriteLeadershipRoles_EmptyPeopleProducesEmptySections(t *testing.T) {
	dir := t.TempDir()
	orig, _ := os.Getwd()
	_ = os.Chdir(dir)
	t.Cleanup(func() { _ = os.Chdir(orig) })

	if err := WriteLeadershipRoles(dir, nil); err != nil {
		t.Fatalf("WriteLeadershipRoles: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(dir, "leadership-roles.json"))
	if err != nil {
		t.Fatalf("leadership-roles.json not created: %v", err)
	}

	var roles LeadershipRoles
	if err := json.Unmarshal(data, &roles); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(roles.TOC)+len(roles.TAB)+len(roles.GB)+len(roles.Marketing) != 0 {
		t.Errorf("expected all sections empty, got %+v", roles)
	}
}
