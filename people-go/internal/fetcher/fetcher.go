package fetcher

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/castrojo/people-website/people-go/internal/models"
	"github.com/google/go-github/v68/github"
	"golang.org/x/oauth2"
	"gopkg.in/yaml.v3"
)

const (
	cncfOwner       = "cncf"
	cncfRepo        = "people"
	peopleFile      = "people.json"
	landscapeOwner  = "cncf"
	landscapeRepo   = "landscape"
	landscapeFile   = "landscape.yml"
	landscapeRawURL = "https://raw.githubusercontent.com/cncf/landscape/master/landscape.yml"
	logoBaseURL     = "https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/"
)
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

// LatestLandscapeSHA returns the latest commit SHA touching landscape.yml in cncf/landscape.
func (c *Client) LatestLandscapeSHA(ctx context.Context) (string, error) {
	commits, _, err := c.gh.Repositories.ListCommits(ctx, landscapeOwner, landscapeRepo, &github.CommitsListOptions{
		Path:        landscapeFile,
		ListOptions: github.ListOptions{PerPage: 1},
	})
	if err != nil {
		return "", fmt.Errorf("list landscape commits: %w", err)
	}
	if len(commits) == 0 {
		return "", fmt.Errorf("no commits found for %s", landscapeFile)
	}
	return commits[0].GetSHA(), nil
}

// landscapeYAML holds just enough of the landscape.yml structure to extract
// project names and logo filenames.
type landscapeYAML struct {
	Landscape []struct {
		Subcategories []struct {
			Items []struct {
				Name string `yaml:"name"`
				Logo string `yaml:"logo"`
			} `yaml:"items"`
		} `yaml:"subcategories"`
	} `yaml:"landscape"`
}

// FetchLandscapeLogos downloads landscape.yml from cncf/landscape and returns
// a normalized map of project name (lowercase) → full logo URL.
// It uses the raw GitHub URL to avoid API rate limits on large files.
func (c *Client) FetchLandscapeLogos(ctx context.Context) (map[string]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, landscapeRawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download landscape.yml: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download landscape.yml: HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read landscape.yml: %w", err)
	}

	var parsed landscapeYAML
	if err := yaml.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("parse landscape.yml: %w", err)
	}

	logos := make(map[string]string)
	for _, cat := range parsed.Landscape {
		for _, sub := range cat.Subcategories {
			for _, item := range sub.Items {
				if item.Name == "" || item.Logo == "" {
					continue
				}
				// Normalize: strip leading "./" that appears in some landscape.yml entries
				logo := strings.TrimPrefix(item.Logo, "./")
				url := logoBaseURL + logo
				logos[item.Name] = url
				logos[strings.ToLower(item.Name)] = url
			}
		}
	}
	return logos, nil
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
