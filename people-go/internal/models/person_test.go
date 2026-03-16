package models

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestToSafe_EmailNotExposed is the critical privacy guarantee:
// email and wechat values MUST NOT appear in SafePerson JSON output.
func TestToSafe_EmailNotExposed(t *testing.T) {
	p := RawPerson{
		Name:   "Alice",
		Email:  "alice@example.com",
		WeChat: "alice_wechat",
	}
	safe := p.ToSafe()
	data, err := json.Marshal(safe)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	s := string(data)
	if strings.Contains(s, "alice@example.com") {
		t.Error("SafePerson JSON must not contain email address")
	}
	if strings.Contains(s, "alice_wechat") {
		t.Error("SafePerson JSON must not contain wechat handle")
	}
}

func TestGitHubHandle(t *testing.T) {
	cases := []struct {
		name   string
		github string
		want   string
	}{
		{"normal handle", "https://github.com/castrojo", "castrojo"},
		{"trailing slash trimmed", "https://github.com/castrojo/", "castrojo"},
		{"handle with dot (yrsuthari.github.io case)", "https://github.com/yrsuthari.github.io", ""},
		{"handle with question mark (K-JooHwan case)", "https://github.com/K-JooHwan?tab=repositories", ""},
		{"org/repo path rejected", "https://github.com/org/repo", ""},
		{"empty string", "", ""},
		{"non-github URL", "https://gitlab.com/user", ""},
		{"hyphenated handle", "https://github.com/some-user", "some-user"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := RawPerson{GitHub: tc.github}
			got := p.GitHubHandle()
			if got != tc.want {
				t.Errorf("GitHubHandle(%q) = %q, want %q", tc.github, got, tc.want)
			}
		})
	}
}

func TestImageURL(t *testing.T) {
	cases := []struct {
		name  string
		image string
		want  string
	}{
		{"empty", "", ""},
		{"filename only", "alice.jpg", ImageBaseURL + "alice.jpg"},
		{"full https URL passthrough", "https://example.com/logo.png", "https://example.com/logo.png"},
		{"full http URL passthrough", "http://example.com/logo.png", "http://example.com/logo.png"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := RawPerson{Image: tc.image}
			got := p.ImageURL()
			if got != tc.want {
				t.Errorf("ImageURL(%q) = %q, want %q", tc.image, got, tc.want)
			}
		})
	}
}

func TestCountryFlag(t *testing.T) {
	cases := []struct {
		name      string
		location  string
		wantEmpty bool
	}{
		{"empty location", "", true},
		{"city comma country", "San Francisco, United States", false},
		{"Tunisia French spelling (Tunisie)", "Tunis, Tunisie", false},
		{"UAE singular typo (United Arab Emirate)", "Dubai, United Arab Emirate", false},
		{"unknown country returns empty", "City, ZZZUnknown9999", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CountryFlag(tc.location)
			if tc.wantEmpty && got != "" {
				t.Errorf("CountryFlag(%q) = %q, want empty", tc.location, got)
			}
			if !tc.wantEmpty && got == "" {
				t.Errorf("CountryFlag(%q) = empty, want non-empty flag emoji", tc.location)
			}
		})
	}
}

func TestPrimaryBadge(t *testing.T) {
	cases := []struct {
		name string
		cats []string
		want string
	}{
		{"empty slice", nil, ""},
		{"single unknown category", []string{"SomeRole"}, "SomeRole"},
		{"golden kubestronaut beats kubestronaut", []string{"Kubestronaut", "Golden-Kubestronaut"}, "Golden-Kubestronaut"},
		{"kubestronaut beats ambassadors", []string{"Ambassadors", "Kubestronaut"}, "Kubestronaut"},
		{"staff returned when only option", []string{"Staff"}, "Staff"},
		{"first category returned when no priority match", []string{"UnknownA", "UnknownB"}, "UnknownA"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := PrimaryBadge(tc.cats)
			if got != tc.want {
				t.Errorf("PrimaryBadge(%v) = %q, want %q", tc.cats, got, tc.want)
			}
		})
	}
}
