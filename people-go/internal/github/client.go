package githubclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

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
	return &Client{gql: githubv4.NewClient(hc), httpClient: hc, token: token}
}

// userQuery is the GraphQL query for user enrichment data.
var userQuery struct {
	User struct {
		AvatarURL string
		Bio       string
		Location  string
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

	// Build search query across key CNCF orgs
	q := fmt.Sprintf("author:%s", handle)
	for _, org := range cncfOrgs {
		q += fmt.Sprintf("+org:%s", org)
	}

	type searchResult struct {
		Items []struct {
			Commit struct {
				Author struct {
					Date string `json:"date"`
				} `json:"author"`
			} `json:"commit"`
		} `json:"items"`
	}

	url := fmt.Sprintf(
		"https://api.github.com/search/commits?q=%s&sort=author-date&order=asc&per_page=1",
		q,
	)

	// Rate limit: authenticated search API is 30 req/min.
	time.Sleep(2 * time.Second)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		fmt.Printf("warn: cncf years req %s: %v\n", handle, err)
		return
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		fmt.Printf("warn: cncf years fetch %s: %v\n", handle, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	var result searchResult
	if err := json.Unmarshal(body, &result); err != nil || len(result.Items) == 0 {
		return
	}

	firstDate, err := time.Parse(time.RFC3339, result.Items[0].Commit.Author.Date)
	if err != nil {
		return
	}

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
		return stats // already enriched (by GraphQL or prior REST call)
	}
	url := fmt.Sprintf("https://api.github.com/users/%s", handle)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return apicache.UserStats{}
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return apicache.UserStats{}
	}
	defer resp.Body.Close()
	var u struct {
		AvatarURL string `json:"avatar_url"`
		Bio       string `json:"bio"`
		Location  string `json:"location"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return apicache.UserStats{}
	}
	// Merge with existing stats (preserve Contributions/YearsContributing if already set)
	existing, _ := cache.Get(handle)
	stats := apicache.UserStats{
		AvatarURL:         u.AvatarURL,
		Location:          u.Location,
		Bio:               u.Bio,
		Contributions:     existing.Contributions,
		PublicRepos:       existing.PublicRepos,
		YearsContributing: existing.YearsContributing,
	}
	cache.Set(handle, stats)
	return stats
}
