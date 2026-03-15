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
		AvatarURL    string
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

	years := time.Now().Year() - firstDate.Year()
	if years < 1 {
		years = 1
	}
	stats.YearsContributing = years
	cache.Set(handle, stats)
	fmt.Printf("  cncf years %s: %d (since %d)\n", handle, years, firstDate.Year())
}
