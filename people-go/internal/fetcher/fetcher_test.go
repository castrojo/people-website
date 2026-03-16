package fetcher

import (
	"strings"
	"testing"
)

func TestTitleCase(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"kubernetes steering", "Kubernetes Steering"},
		{"youki", "Youki"},
		{"", ""},
		{"CNCF", "CNCF"},
		{"argo cd", "Argo Cd"},
		{"the update framework", "The Update Framework"},
	}
	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			got := titleCase(tc.input)
			if got != tc.want {
				t.Errorf("titleCase(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

// TestParseMaintainersCSV_SparseRows verifies that Maturity and Project are
// carried forward when they are blank (sparse CSV format used by cncf/foundation).
func TestParseMaintainersCSV_SparseRows(t *testing.T) {
	t.Helper()
	csvData := "maturity,project,name,company,handle,ownersURL\n" +
		"Graduated,Kubernetes,Alice Smith,ACME Corp,alice,https://example.com\n" +
		",,Bob Jones,BobCo,bob,\n" +
		"Incubating,Argo,Carol Lee,Inc,carol,\n"

	logos := map[string]string{
		"kubernetes": "https://logos.example.com/kubernetes.png",
	}

	maintainers, err := parseMaintainersCSV(strings.NewReader(csvData), logos)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(maintainers) != 3 {
		t.Fatalf("expected 3 maintainers, got %d", len(maintainers))
	}

	alice := maintainers[0]
	if alice.Handle != "alice" {
		t.Errorf("alice.Handle = %q, want 'alice'", alice.Handle)
	}
	if len(alice.Projects) != 1 || alice.Projects[0] != "Kubernetes" {
		t.Errorf("alice.Projects = %v, want [Kubernetes]", alice.Projects)
	}
	if alice.Maturity != "Graduated" {
		t.Errorf("alice.Maturity = %q, want 'Graduated'", alice.Maturity)
	}
	if alice.LogoURL == "" {
		t.Error("alice.LogoURL should be resolved from logos map, got empty")
	}

	// Bob's row has blank Maturity and Project — must inherit from Alice's block.
	bob := maintainers[1]
	if len(bob.Projects) != 1 || bob.Projects[0] != "Kubernetes" {
		t.Errorf("sparse row: bob.Projects = %v, want [Kubernetes]", bob.Projects)
	}
	if bob.Maturity != "Graduated" {
		t.Errorf("sparse row: bob.Maturity = %q, want 'Graduated'", bob.Maturity)
	}

	carol := maintainers[2]
	if len(carol.Projects) != 1 || carol.Projects[0] != "Argo" {
		t.Errorf("carol.Projects = %v, want [Argo]", carol.Projects)
	}
	if carol.Maturity != "Incubating" {
		t.Errorf("carol.Maturity = %q, want 'Incubating'", carol.Maturity)
	}
}

// TestParseMaintainersCSV_EmptyBody verifies that a CSV with only a header row
// returns an empty slice without error.
func TestParseMaintainersCSV_EmptyBody(t *testing.T) {
	csvData := "maturity,project,name,company,handle,ownersURL\n"
	maintainers, err := parseMaintainersCSV(strings.NewReader(csvData), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(maintainers) != 0 {
		t.Errorf("expected 0 maintainers, got %d", len(maintainers))
	}
}

// TestParseMaintainersCSV_DeduplicatesHandles verifies that a maintainer appearing
// in multiple projects is deduplicated and accumulates all projects.
func TestParseMaintainersCSV_DeduplicatesHandles(t *testing.T) {
	csvData := "maturity,project,name,company,handle,ownersURL\n" +
		"Graduated,Kubernetes,Alice Smith,Acme,alice,\n" +
		"Incubating,Argo,Alice Smith,Acme,alice,\n"

	maintainers, err := parseMaintainersCSV(strings.NewReader(csvData), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(maintainers) != 1 {
		t.Fatalf("expected 1 deduplicated maintainer, got %d", len(maintainers))
	}
	if len(maintainers[0].Projects) != 2 {
		t.Errorf("expected 2 projects for alice, got %v", maintainers[0].Projects)
	}
	// Highest maturity should win: Graduated > Incubating
	if maintainers[0].Maturity != "Graduated" {
		t.Errorf("expected Maturity = Graduated (highest), got %q", maintainers[0].Maturity)
	}
}
