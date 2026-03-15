set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    just --list

# Full build: Go sync → Astro
build:
    npm ci
    cd people-go && go build -o people cmd/people/main.go && ./people
    npm run build

# Dev server with hot reload (port 4322 — avoids conflict with firehose on 4321)
dev:
    cd people-go && go build -o people cmd/people/main.go && ./people
    npm run dev -- --port 4322

# Serve built output and open browser
serve:
    npm run build
    xdg-open http://localhost:4322/people-website & sleep 1 && npx astro preview --port 4322 --host

# Build the production container image locally
container-build:
    podman build -t ghcr.io/castrojo/people-website:local -f Containerfile .

# Run the locally built container
container-run:
    xdg-open http://localhost:8080/people-website & sleep 1 && podman run --rm -p 8080:8080 ghcr.io/castrojo/people-website:local

# Run Go sync only (useful for testing backend without full build)
sync:
    cd people-go && go build -o people cmd/people/main.go && ./people
