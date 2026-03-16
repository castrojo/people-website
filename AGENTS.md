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

## Data Files in src/data/ (20 files — backlog to consolidate)

Generated/gitignored (rebuilt by Go sync):
- `changelog.json` (sharded into changelog-0/1/2/3.json + changelog-meta.json)
- `changelog-0.json`, `changelog-1.json`, `changelog-2.json`, `changelog-3.json`
- `changelog-meta.json`
- `heroes.json`
- `stats.json`
- `people-index.json`
- `landscape_logos.json`
- `maintainers.json`
- `feed.xml`

Committed (manually maintained):
- `staff-support.json` — CNCF staff sections (maintainers, toc, tab, governing-board, marketing, ambassadors, kubestronauts)
- `memorial.json`
- `people-emeritus.json`
- `leadership.json` (gb, toc, tab, marketing roles)
- `gb.json`, `toc.json`, `tab.json`, `marketing.json`
- `staff-assignments.json`

## Architectural Backlog (planned improvements)

These are tracked gaps — not regressions — identified when designing the simpler projects/endusers architecture:

1. **[HIGH] Extract person-renderer.ts** — `PersonCard.astro` + `feed-loader.ts` duplicate ~765 lines of card HTML. Any card change must be made in BOTH files or they drift. This is the #1 source of bugs. Extract to single `src/lib/person-renderer.ts` mirroring `project-renderer.ts` pattern.

2. **[HIGH] Extract keyboard.ts and tabs.ts** — Unlike projects/endusers which have `src/lib/keyboard.ts` and `src/lib/tabs.ts` as standalone modules with unit tests, people-website embeds this logic in `PeopleLayout.astro`. Extract to separate files, add Vitest unit tests.

3. **[MEDIUM] Consolidate JSON data files** — 20+ data files in `src/data/`. Many role-specific files (`gb.json`, `toc.json`, `tab.json`, `marketing.json`, `staff-assignments.json`) could be unified into one `leadership.json`. The changelog sharding (0-3) is a workaround for file size — evaluate if still needed.

4. **[MEDIUM] Extract CSS to src/styles/** — Unlike projects-website which has `variables.css` + `layout.css` + `cards.css` as separate importable files, people-website has all CSS inline in `PeopleLayout.astro`. Extract to `src/styles/` directory.

5. **[LOW] Switch logo source from landscape.yml to full.json** — logos currently fetched from YAML, same data available in full.json as JSON. Simplifies parsing.

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
