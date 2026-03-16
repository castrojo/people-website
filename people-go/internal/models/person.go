package models

import (
	"encoding/json"
	"regexp"
	"strings"

	"github.com/biter777/countries"
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
	// Reject handles that look like paths (e.g. org/repo) or malformed URLs
	// (e.g. user?tab=repos, user.github.io). GitHub usernames only allow
	// alphanumeric and hyphens — any of these characters indicates bad data.
	if strings.ContainsAny(handle, "/.?") {
		return ""
	}
	return handle
}

// ImageURL returns the full URL for the person's profile image.
// Some entries in cncf/people use a full external URL in the image field
// rather than just a filename — pass those through directly.
func (p RawPerson) ImageURL() string {
	if p.Image == "" {
		return ""
	}
	if strings.HasPrefix(p.Image, "http://") || strings.HasPrefix(p.Image, "https://") {
		return p.Image
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
	CompanyLandscapeURL string `json:"companyLandscapeUrl,omitempty"`
	Location    string  `json:"location,omitempty"`
	CountryFlag  string  `json:"countryFlag,omitempty"`
	PrimaryBadge string  `json:"primaryBadge,omitempty"`
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
	handle := p.GitHubHandle()
	avatarURL := ""
	if handle != "" {
		avatarURL = "https://avatars.githubusercontent.com/" + handle
	}
	return SafePerson{
		Name:          p.Name,
		Handle:        handle,
		GitHub:        p.GitHub,
		ImageURL:      p.ImageURL(),
		AvatarURL:     avatarURL,
		Bio:           stripHTML(p.Bio),
		Pronouns:      p.Pronouns,
		Company:             p.Company,
		CompanyLandscapeURL: p.CompanyLandscapeURL,
		Location:            p.Location,
		CountryFlag:         CountryFlag(p.Location),
		PrimaryBadge:        PrimaryBadge(p.Category),
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

// countryOverrides maps known typos/non-English spellings to their English equivalents
// so countries.ByName can find them correctly.
var countryOverrides = map[string]string{
	"Tunisie":             "Tunisia",             // French spelling
	"United Arab Emirate": "United Arab Emirates", // singular typo in source data
	"United of States":    "United States",        // typo in source data
}

// CountryFlag derives a flag emoji from a freeform location string by
// extracting the last comma-separated segment (typically the country name)
// and looking it up via biter777/countries. Exported so writer can backfill.
func CountryFlag(location string) string {
	if location == "" {
		return ""
	}
	parts := strings.Split(location, ",")
	raw := strings.TrimSpace(parts[len(parts)-1])
	if name, ok := countryOverrides[raw]; ok {
		raw = name
	}
	c := countries.ByName(raw)
	if c == countries.Unknown {
		return ""
	}
	return c.Emoji()
}

// logoPriority defines the badge resolution order — first match wins.
var logoPriority = []string{
	"Golden-Kubestronaut",
	"Kubestronaut",
	"Ambassadors",
	"Technical Oversight Committee",
	"End User TAB",
	"Staff",
}

// PrimaryBadge returns the highest-priority category badge key for a person.
// Exported so writer can backfill existing events. Falls back to first category.
func PrimaryBadge(cats []string) string {
	for _, prio := range logoPriority {
		for _, c := range cats {
			if c == prio {
				return prio
			}
		}
	}
	if len(cats) > 0 {
		return cats[0]
	}
	return ""
}

