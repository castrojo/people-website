package fetcher

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/castrojo/people-website/people-go/internal/models"
	"github.com/google/go-github/v68/github"
	"golang.org/x/oauth2"
)

const (
	cncfOwner  = "cncf"
	cncfRepo   = "people"
	peopleFile = "people.json"
)

// Client fetches data from the cncf/people GitHub repository.
type Client struct {
	gh *github.Client
}

// New creates a Client. token may be empty for unauthenticated requests
// (lower rate limit).
func New(ctx context.Context, token string) *Client {
	var hc *http.Client
	if token != "" {
		ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
		hc = oauth2.NewClient(ctx, ts)
	}
	return &Client{gh: github.NewClient(hc)}
}

// LatestSHA returns the latest commit SHA on the default branch of cncf/people.
func (c *Client) LatestSHA(ctx context.Context) (string, error) {
	commits, _, err := c.gh.Repositories.ListCommits(ctx, cncfOwner, cncfRepo, &github.CommitsListOptions{
		Path:        peopleFile,
		ListOptions: github.ListOptions{PerPage: 1},
	})
	if err != nil {
		return "", fmt.Errorf("list commits: %w", err)
	}
	if len(commits) == 0 {
		return "", fmt.Errorf("no commits found for %s", peopleFile)
	}
	return commits[0].GetSHA(), nil
}

// FetchPeople downloads people.json at the given commit SHA and returns
// the parsed list of persons.
func (c *Client) FetchPeople(ctx context.Context, sha string) ([]models.RawPerson, error) {
	opts := &github.RepositoryContentGetOptions{Ref: sha}
	file, _, _, err := c.gh.Repositories.GetContents(ctx, cncfOwner, cncfRepo, peopleFile, opts)
	if err != nil {
		return nil, fmt.Errorf("get contents: %w", err)
	}

	downloadURL := file.GetDownloadURL()
	if downloadURL == "" {
		return nil, fmt.Errorf("no download URL for %s", peopleFile)
	}

	resp, err := http.Get(downloadURL) //nolint:noctx
	if err != nil {
		return nil, fmt.Errorf("download people.json: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	var people []models.RawPerson
	if err := json.Unmarshal(body, &people); err != nil {
		return nil, fmt.Errorf("parse people.json: %w", err)
	}
	return people, nil
}
