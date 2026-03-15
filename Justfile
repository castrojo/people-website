set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    just --list

# Full build: Go sync → Astro
build:
    npm ci
    cd people-go && go build -o people cmd/people/main.go && ./people
    npm run build

# DEFAULT for all local iterations: sync data then start hot-reload dev server
sync-dev:
    just sync
    just dev

# Dev server with hot reload — only when data hasn't changed
dev:
    npx astro dev --port 4322 --host

# Serve with hot-reload dev server and open browser
serve:
    xdg-open http://localhost:4322/people-website/ & just sync-dev

# Run Go sync only (useful for testing backend without full build)
sync:
    cd people-go && go build -o people cmd/people/main.go && ./people

# Build the production container image locally
container-build:
    podman build -t ghcr.io/castrojo/people-website:local -f Containerfile .

# Run the locally built container
container-run:
    xdg-open http://localhost:8080/people-website & sleep 1 && podman run --rm -p 8080:8080 ghcr.io/castrojo/people-website:local
