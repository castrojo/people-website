set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    just --list

# Full build: Go sync → Astro
build:
    npm ci
    cd people-go && go build -o people cmd/people/main.go && ./people
    npm run build

# Dev server with hot reload (port 4322, --host required for devcontainer port forwarding)
dev:
    npx astro dev --port 4322 --host

# Sync data then start dev server
sync-dev:
    just sync
    just dev

# Serve with hot-reload dev server and open browser
serve:
    xdg-open http://localhost:4322/people-website/ & npx astro dev --port 4322 --host

# Build the production container image locally
container-build:
    podman build -t ghcr.io/castrojo/people-website:local -f Containerfile .

# Run the locally built container
container-run:
    xdg-open http://localhost:8080/people-website & sleep 1 && podman run --rm -p 8080:8080 ghcr.io/castrojo/people-website:local

# Run Go sync only (useful for testing backend without full build)
sync:
    cd people-go && go build -o people cmd/people/main.go && ./people
