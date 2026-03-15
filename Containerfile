# syntax=docker/dockerfile:1
# Multi-stage Chainguard build — Renovate updates all digests automatically.
#
# Stage 1: Build Go binary and write empty changelog.json
# Stage 2: Build Astro static site
# Stage 3: Serve with Chainguard nginx (nonroot, port 8080)

# ── Stage 1: Go pipeline ────────────────────────────────────────────────────
FROM cgr.dev/chainguard/go:latest AS go-builder

WORKDIR /build
COPY people-go/ ./people-go/

RUN cd people-go && go build -o people cmd/people/main.go

RUN mkdir -p src/data && cd people-go && ./people

# ── Stage 2: Astro site builder ─────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest-dev AS site-builder

USER root
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci

COPY src/ ./src/
COPY public/ ./public/
COPY astro.config.mjs tsconfig.json ./

COPY --from=go-builder /build/src/data/changelog.json ./src/data/changelog.json

RUN npm run build

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/nginx:latest

COPY --from=site-builder /build/dist/ /usr/share/nginx/html/people-website/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
