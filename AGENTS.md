# people-website — Agent Guide

**First action**: Load the shared skill, then check what you're working on.

```
/skills cncf-dev
```

## What This Repo Is

CNCF People discovery site — the gold standard reference for the Indie Cloud Native trilogy.
Shows 3,747 CNCF community members (Kubestronauts, Ambassadors, TOC, Staff, etc.)
from `cncf/people` people.json + `cncf/foundation` maintainers.csv.

- **Repo**: `castrojo/people-website` (branch: `main`)
- **Live**: `https://castrojo.github.io/people-website/`
- **Container**: `ghcr.io/castrojo/people`

## Quick Start

```bash
just serve        # build container → run on :8080 → open browser
just sync-dev     # Go sync + Astro hot-reload (fast UI iteration)
just build        # full production build to dist/
just sync         # Go backend only (regenerate changelog.json)
just test         # npx vitest run
just test-e2e     # npx playwright test
```

## Role in the Trilogy

People-website is the **reference implementation**. When designing features for
projects-website or endusers-website, check people-website first.

However, people-website has accumulated complexity that the other sites deliberately
avoid. See the backlog below for improvements that should be backported FROM the
simpler architecture back TO people-website.

## Architecture

```
cncf/people (people.json + images) → Go backend (people-go/)
→ GitHub API enrichment (avatars, bio, stats) → changelog.json + stats.json
→ Astro SSG → GitHub Pages
```

Key files:
- `people-go/` — Go backend with GitHub API enrichment (requires GITHUB_TOKEN in CI)
- `src/components/PersonCard.astro` — SSR card (first 200 cards)
- `src/lib/feed-loader.ts` — client-side card renderer (mirrors PersonCard.astro)
- `src/lib/maintainer-loader.ts` — maintainer tab renderer
- `src/layouts/PeopleLayout.astro` — gold standard layout reference

## Important: Privacy Rules

NEVER expose `email` or `wechat` fields from people.json. Run before any deploy:
```bash
grep -r email dist/ && grep -r wechat dist/  # must return empty
```

## Architectural Backlog (improvements from simpler-site design)

These items are NOT regressions — they are planned improvements identified when
designing projects-website and endusers-website with simpler architecture:

1. **Extract person-renderer.ts** — eliminate PersonCard.astro + feed-loader.ts duality
   (~765 duplicate lines). This is the #1 source of bugs: any card change must be
   made in both files or they drift.

2. **Extract tabs to tabs.ts** with Vitest unit tests

3. **Switch logo fetch** from landscape.yml (YAML parsing) to full.json (JSON, same data)

4. **Consolidate JSON data files** — currently 20+:
   heroes.json, stats.json, people-index.json, staff-support.json, landscape_logos.json,
   maintainers.json, api_cache.json, etc. Many can be merged or eliminated.

5. **Shared CSS variables as importable files** (currently inline in PeopleLayout.astro)

## Skills

- Load `/skills cncf-dev` for full architecture spec, cross-site parity rules, CSS gotchas
- Landscape MCP server available for logo/project lookups: `cncf-landscape` MCP

## Testing Rules

- Run `npx playwright test` before and after any change
- People-website has more tests than projects/endusers (gold standard)
- Visual layout tests in `tests/e2e/visual-layout.spec.ts` check computed CSS
- Privacy audit before any deploy: `grep -r email dist/ && grep -r wechat dist/`

## Branch + Commit

```bash
git add . && git commit -m "feat: description

Assisted-by: Claude Sonnet 4.6 via GitHub Copilot
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
```

Branch is `main`. Push directly (castrojo-owned, no fork workflow).
