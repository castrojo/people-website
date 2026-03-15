package githubclient

import (
	"context"
	"fmt"
	"net/http"

	"github.com/castrojo/people-website/people-go/internal/apicache"
	"github.com/shurcooL/githubv4"
	"golang.org/x/oauth2"
)

// Client wraps the GitHub GraphQL API for user enrichment.
type Client struct {
	gql *githubv4.Client
}

// New creates a GraphQL client authenticated with token.
func New(ctx context.Context, token string) *Client {
	var hc *http.Client
	if token != "" {
		ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
		hc = oauth2.NewClient(ctx, ts)
	}
	return &Client{gql: githubv4.NewClient(hc)}
}

// userQuery is the GraphQL query for user enrichment data.
var userQuery struct {
	User struct {
		AvatarURL   string
		Followers   struct{ TotalCount int }
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
		// Non-fatal: enrichment is best-effort
		fmt.Printf("warn: enrich %s: %v\n", handle, err)
		return apicache.UserStats{}
	}

	stats := apicache.UserStats{
		AvatarURL:     userQuery.User.AvatarURL,
		Contributions: userQuery.User.ContributionsCollection.ContributionCalendar.TotalContributions,
		Followers:     userQuery.User.Followers.TotalCount,
		PublicRepos:   userQuery.User.Repositories.TotalCount,
	}
	cache.Set(handle, stats)
	return stats
}
