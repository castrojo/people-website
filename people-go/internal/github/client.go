package githubclient

import (
	"context"
	"fmt"
	"net/http"
	"time"

	githubapi "github.com/google/go-github/v68/github"
	"github.com/castrojo/people-website/people-go/internal/apicache"
	"github.com/shurcooL/githubv4"
	"golang.org/x/oauth2"
)

// cncfOrgs are the key CNCF-umbrella GitHub orgs we search for first contribution.
var cncfOrgs = []string{
	"cncf", "kubernetes", "prometheus", "envoyproxy", "opentelemetry",
	"containerd", "helm", "fluentd", "open-policy-agent", "jaegertracing",
}

// Client wraps the GitHub GraphQL API for user enrichment.
type Client struct {
	gql        *githubv4.Client
	httpClient *http.Client
	ghClient   *githubapi.Client
	token      string
}

// New creates a GraphQL client authenticated with token.
func New(ctx context.Context, token string) *Client {
	var hc *http.Client
	if token != "" {
		ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
		hc = oauth2.NewClient(ctx, ts)
	} else {
		hc = &http.Client{}
	}
	return &Client{gql: githubv4.NewClient(hc), httpClient: hc, ghClient: githubapi.NewClient(hc), token: token}
}

// userQuery is the GraphQL query for user enrichment data.
var userQuery struct {
	User struct {
		AvatarURL string
		Bio       string
		Location  string
		Pronouns  string
		Repositories struct {
			TotalCount int
		} `graphql:"repositories(privacy: PUBLIC)"`
		ContributionsCollection struct {
			ContributionCalendar struct {
				TotalContributions int
			}
		} `graphql:"contributionsCollection"`
	} `graphql:"user(login: $login)"`
}

// Enrich fetches GitHub stats for a user handle, using the API cache.
// Falls back to empty stats on error (non-fatal — enrichment is best-effort).
func (c *Client) Enrich(ctx context.Context, handle string, cache *apicache.Cache) apicache.UserStats {
	if stats, ok := cache.Get(handle); ok {
		return stats
	}

	vars := map[string]interface{}{
		"login": githubv4.String(handle),
	}

	if err := c.gql.Query(ctx, &userQuery, vars); err != nil {
		fmt.Printf("warn: enrich %s: %v\n", handle, err)
		return apicache.UserStats{}
	}

	stats := apicache.UserStats{
		AvatarURL:     userQuery.User.AvatarURL,
		Location:      userQuery.User.Location,
		Bio:           userQuery.User.Bio,
		Pronouns:      userQuery.User.Pronouns,
		Contributions: userQuery.User.ContributionsCollection.ContributionCalendar.TotalContributions,
		PublicRepos:   userQuery.User.Repositories.TotalCount,
	}
	cache.Set(handle, stats)
	return stats
}

// EnrichCNCFYears searches for the user's earliest commit in CNCF orgs and
// sets YearsContributing on the cached stats. Only called on incremental runs.
func (c *Client) EnrichCNCFYears(ctx context.Context, handle string, cache *apicache.Cache) {
	stats, ok := cache.Get(handle)
	if ok && stats.YearsContributing > 0 {
		return // already enriched
	}
	if !ok {
		stats = apicache.UserStats{}
	}

	// Rate limit: search API is 30 req/min — keep sequential with sleep.
	time.Sleep(2 * time.Second)

	q := fmt.Sprintf("author:%s", handle)
	for _, org := range cncfOrgs {
		q += fmt.Sprintf("+org:%s", org)
	}

	opts := &githubapi.SearchOptions{
		Sort:        "author-date",
		Order:       "asc",
		ListOptions: githubapi.ListOptions{PerPage: 1},
	}
	result, _, err := c.ghClient.Search.Commits(ctx, q, opts)
	if err != nil || result == nil || len(result.Commits) == 0 {
		return
	}

	firstDate := result.Commits[0].Commit.Author.GetDate().Time

	// CNCF was founded in 2015 — cap the floor there
	firstYear := firstDate.Year()
	if firstYear < 2015 {
		firstYear = 2015
	}

	years := time.Now().Year() - firstYear
	if years < 1 {
		years = 1
	}
	stats.YearsContributing = years
	cache.Set(handle, stats)
	fmt.Printf("  cncf years %s: %d (since %d)\n", handle, years, firstDate.Year())
}

// EnrichProfile fetches a GitHub user's profile via REST API and caches the result.
// Uses AvatarURL as the "fetched" sentinel — if non-empty, profile is already cached.
// Falls back to empty stats on error (non-fatal).
func (c *Client) EnrichProfile(ctx context.Context, handle string, cache *apicache.Cache) apicache.UserStats {
	if stats, ok := cache.Get(handle); ok && stats.AvatarURL != "" {
		return stats
	}
	user, _, err := c.ghClient.Users.Get(ctx, handle)
	if err != nil || user == nil {
		return apicache.UserStats{}
	}
	existing, _ := cache.Get(handle)
	stats := apicache.UserStats{
		AvatarURL:         derefString(user.AvatarURL),
		Location:          derefString(user.Location),
		Bio:               derefString(user.Bio),
		Contributions:     existing.Contributions,
		PublicRepos:       derefInt(user.PublicRepos),
		YearsContributing: existing.YearsContributing,
		Pronouns:          existing.Pronouns,
	}
	cache.Set(handle, stats)
	return stats
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefInt(n *int) int {
	if n == nil {
		return 0
	}
	return *n
}
