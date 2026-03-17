package models

import "time"

// ProjectDetail pairs a project name with its CNCF maturity level.
type ProjectDetail struct {
	Name     string `json:"name"`
	Maturity string `json:"maturity"`
}

// SafeMaintainer is the output representation of a CNCF project maintainer,
// sourced from cncf/foundation project-maintainers.csv.
// One entry per unique GitHub handle; ProjectDetails aggregates all projects they maintain.
type SafeMaintainer struct {
	Name              string          `json:"name"`
	Handle            string          `json:"handle"`
	Company           string          `json:"company,omitempty"`
	Location          string          `json:"location,omitempty"`
	CountryFlag       string          `json:"countryFlag,omitempty"`
	Bio               string          `json:"bio,omitempty"`
	Projects          []string        `json:"projects"`                 // names only, kept for compat
	ProjectDetails    []ProjectDetail `json:"projectDetails,omitempty"` // name + maturity per project
	Maturity          string          `json:"maturity"`                 // highest maturity across projects
	AvatarURL         string          `json:"avatarUrl,omitempty"`
	OwnersURL         string          `json:"ownersUrl,omitempty"`
	LogoURL           string          `json:"logoUrl,omitempty"`
	UpdatedAt         time.Time       `json:"updatedAt,omitempty"`
	YearsContributing int             `json:"yearsContributing,omitempty"`
}

// maturityRank returns a sortable rank for maturity values (higher = more mature).
func maturityRank(m string) int {
	switch m {
	case "Graduated":
		return 3
	case "Incubating":
		return 2
	case "Sandbox", "Sandbox ":
		return 1
	default:
		return 0
	}
}

// HigherMaturity returns whichever of a or b is more mature.
func HigherMaturity(a, b string) string {
	if maturityRank(a) >= maturityRank(b) {
		return a
	}
	return b
}
