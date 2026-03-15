# syntax=docker/dockerfile:1
# Multi-stage Chainguard build — Renovate updates all digests automatically.
#
# Stage 1: Build Go binary and write empty changelog.json
# Stage 2: Build Astro static site
# Stage 3: Serve with Chainguard nginx (nonroot, port 8080)

ARG SKIP_GO_SYNC=false

# ── Stage 1: Go pipeline ────────────────────────────────────────────────────
FROM cgr.dev/chainguard/go:latest AS go-builder

ARG SKIP_GO_SYNC=false

WORKDIR /build
COPY people-go/ ./people-go/

RUN cd people-go && go build -o people cmd/people/main.go

RUN mkdir -p src/data
COPY src/data/ ./src/data/

RUN if [ "${SKIP_GO_SYNC}" != "true" ]; then cd people-go && ./people; fi

RUN mkdir -p public/data && \
    cp src/data/changelog.json public/data/changelog.json 2>/dev/null || true && \
    cp src/data/maintainers.json public/data/maintainers.json 2>/dev/null || true && \
    cp src/data/landscape_logos.json public/data/landscape_logos.json 2>/dev/null || true

# ── Stage 2: Astro site builder ─────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest-dev AS site-builder

USER root
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci

COPY src/ ./src/
COPY public/ ./public/
COPY astro.config.mjs tsconfig.json ./

COPY --from=go-builder /build/src/data/ ./src/data/
COPY --from=go-builder /build/public/data/ ./public/data/

RUN npm run build

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/nginx:latest

COPY --from=site-builder /build/dist/ /usr/share/nginx/html/people-website/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
