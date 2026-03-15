set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    just --list

# DEFAULT: build container, stop old one, run new one, open browser
serve:
    just container-build
    podman rm -f people-website 2>/dev/null || true
    podman run -d --name people-website -p 8080:8080 ghcr.io/castrojo/people-website:local
    xdg-open http://localhost:8080/people-website/

# Full production build (Go + Astro → dist/)
build:
    npm ci
    cd people-go && go build -o people cmd/people/main.go && ./people
    npm run build

# Build the container image
container-build:
    podman build -t ghcr.io/castrojo/people-website:local -f Containerfile .

# Stop the running container
stop:
    podman rm -f people-website 2>/dev/null || true

# Go sync only (regenerate changelog.json locally)
sync:
    cd people-go && go build -o people cmd/people/main.go && ./people

# Astro hot-reload dev server (no container — UI iteration only)
dev:
    npx astro dev --port 4322 --host

# Sync data then hot-reload dev (fast UI iteration, no container rebuild)
sync-dev:
    just sync
    just dev
