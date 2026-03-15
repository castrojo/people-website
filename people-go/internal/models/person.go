package models

import (
	"encoding/json"
	"regexp"
	"strings"
)

const (
	ImageBaseURL = "https://raw.githubusercontent.com/cncf/people/main/images/"
	GitHubBase   = "https://github.com/"
)

// RawPerson matches the actual cncf/people people.json schema.
// Sensitive fields (Email, WeChat) are parsed but never forwarded to output.
type RawPerson struct {
	Name              string   `json:"name"`
	Bio               string   `json:"bio"`
	Company           string   `json:"company"`
	CompanyLandscapeURL string `json:"company_landscape_url"`
	CompanyLogoURL    string   `json:"company_logo_url"`
	Pronouns          string   `json:"pronouns"`
	Location          string   `json:"location"`
	LinkedIn          string   `json:"linkedin"`
	Twitter           string   `json:"twitter"`
	GitHub            string   `json:"github"`
	Website           string   `json:"website"`
	YouTube           string   `json:"youtube"`
	Mastodon          string   `json:"mastodon"`
	Bluesky           string   `json:"bluesky"`
	Substack          string   `json:"substack"`
	CertDirectory     string   `json:"certdirectory"`
	SlackID           string   `json:"slack_id"`
	Image             string   `json:"image"`
	Category          []string `json:"category"`
	Projects          []string `json:"projects"`
	Expertise         []string `json:"expertise"`
	Languages         []string `json:"languages"`
	Priority          json.RawMessage `json:"priority,omitempty"` // int or "" — not used
	GBRole            string   `json:"gb_role"`
	TOCRole           string   `json:"toc_role"`
	TABRole           string   `json:"tab_role"`
	// Intentionally omitted from output: email, wechat
	Email  string `json:"email"`
	WeChat string `json:"wechat"`
}

// Key returns a stable unique identifier for this person.
// Prefers the GitHub handle; falls back to the image slug.
func (p RawPerson) Key() string {
	if handle := p.GitHubHandle(); handle != "" {
		return "gh:" + handle
	}
	if p.Image != "" {
		return "img:" + strings.TrimSuffix(p.Image, ".jpg")
	}
	return "name:" + strings.ToLower(strings.ReplaceAll(p.Name, " ", "-"))
}

// GitHubHandle extracts the GitHub username from the full profile URL.
func (p RawPerson) GitHubHandle() string {
	trimmed := strings.TrimRight(p.GitHub, "/")
	if !strings.HasPrefix(trimmed, GitHubBase) {
		return ""
	}
	handle := strings.TrimPrefix(trimmed, GitHubBase)
	// Reject handles that look like paths (e.g. org/repo)
	if strings.Contains(handle, "/") {
		return ""
	}
	return handle
}

// ImageURL returns the full URL for the person's profile image.
func (p RawPerson) ImageURL() string {
	if p.Image == "" {
		return ""
	}
	return ImageBaseURL + p.Image
}

// PrimaryCategory returns the first category or empty string.
func (p RawPerson) PrimaryCategory() string {
	if len(p.Category) > 0 {
		return p.Category[0]
	}
	return ""
}

// SafePerson is the output-safe version — no sensitive data.
type SafePerson struct {
	Name       string   `json:"name"`
	Handle     string   `json:"handle,omitempty"`
	GitHub     string   `json:"github,omitempty"`
	ImageURL   string   `json:"imageUrl,omitempty"`
	Bio        string   `json:"bio,omitempty"`
	Pronouns   string   `json:"pronouns,omitempty"`
	Company    string   `json:"company,omitempty"`
	CompanyLogoURL string `json:"companyLogoUrl,omitempty"`
	Location   string   `json:"location,omitempty"`
	LinkedIn   string   `json:"linkedin,omitempty"`
	Twitter    string   `json:"twitter,omitempty"`
	YouTube    string   `json:"youtube,omitempty"`
	Website    string   `json:"website,omitempty"`
	Bluesky    string   `json:"bluesky,omitempty"`
	Mastodon   string   `json:"mastodon,omitempty"`
	CertDirectory string `json:"certDirectory,omitempty"`
	Category   []string `json:"category"`
	Projects   []string `json:"projects,omitempty"`
	// GitHub enrichment fields
	AvatarURL        string `json:"avatarUrl,omitempty"`
	Contributions    int    `json:"contributions,omitempty"`
	PublicRepos      int    `json:"publicRepos,omitempty"`
	YearsContributing int   `json:"yearsContributing,omitempty"`
}

// ToSafe converts a RawPerson to a SafePerson, dropping sensitive fields.
func (p RawPerson) ToSafe() SafePerson {
	return SafePerson{
		Name:          p.Name,
		Handle:        p.GitHubHandle(),
		GitHub:        p.GitHub,
		ImageURL:      p.ImageURL(),
		Bio:           stripHTML(p.Bio),
		Pronouns:      p.Pronouns,
		Company:       p.Company,
		CompanyLogoURL: p.CompanyLogoURL,
		Location:      p.Location,
		LinkedIn:      p.LinkedIn,
		Twitter:       p.Twitter,
		YouTube:       p.YouTube,
		Website:       p.Website,
		Bluesky:       p.Bluesky,
		Mastodon:      p.Mastodon,
		CertDirectory: p.CertDirectory,
		Category:      p.Category,
		Projects:      p.Projects,
	}
}

var htmlTagRe = regexp.MustCompile(`<[^>]+>`)

// stripHTML removes HTML tags and decodes common entities.
func stripHTML(s string) string {
	s = htmlTagRe.ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", `"`)
	s = strings.ReplaceAll(s, "&#39;", "'")
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	return strings.TrimSpace(s)
}

// RawPeopleMap returns a map keyed by the person's unique Key().
func RawPeopleMap(people []RawPerson) map[string]RawPerson {
	m := make(map[string]RawPerson, len(people))
	for _, p := range people {
		k := p.Key()
		if k != "" {
			m[k] = p
		}
	}
	return m
}

