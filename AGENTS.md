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

---

## Header Migration (PENDING — canonical design from projects-website)

> **Status:** Not yet implemented. projects-website is the reference. Implement this section exactly.

The canonical header was finalized on 2026-03-16 in `castrojo/projects-website`.
All three sites must be pixel-perfect identical in header structure.
See `~/src/skills/cncf-layout/SKILL.md` → "Required Header Structure" for the full spec.

### What needs to change in people-website

#### HTML (`src/layouts/PeopleLayout.astro`)

- [ ] **Logo**: Change `width={56} height={56}` → `width={42} height={42}` on both `CNCFLogoColor` and `CNCFLogoWhite`
- [ ] **Remove slogan**: Delete `<p class="site-subtitle" id="rotating-slogan">` element
- [ ] **Remove slogan JS**: Delete the `SLOGANS` array + `setInterval` block
- [ ] **Remove slogan CSS**: Delete `.site-subtitle` and `.site-subtitle.fade` rules
- [ ] **Move nav-group outside header-left**: `nav-group` div must be a direct child of `header-inner`, NOT nested inside `header-left`
- [ ] **Add clear button**: Add `<button id="search-clear" class="search-clear" aria-label="Clear search">✕</button>` inside `.search-wrapper`
- [ ] **Add clear button JS**: Add the clear button event handler (see skill for exact code)
- [ ] **Dark mode logo rules**: Remove redundant `.cncf-logo-wrapper .logo-dark` and `[data-theme="dark"] .cncf-logo-wrapper .logo-light` lines

#### CSS — extract and update (see backlog item #4)

Since people-website has all CSS inline, these changes go in the inline `<style is:global>` block
until CSS is extracted to `src/styles/layout.css` (a separate backlog task):

```css
/* Replace old values with these canonical values */
.logo-title            { gap: 0.5rem; }
.cncf-logo-wrapper img { height: 42px; width: auto; object-fit: contain; display: block; }
.title-block           { height: 42px; display: flex; align-items: center; }
                         /* REMOVE: flex-direction: column, text-align: center */
.site-title            { font-size: 1.375rem; font-weight: 700; line-height: 1.1; margin: 0; }
.header-left           { flex-shrink: 0; }   /* REMOVE: flex: 1 if present */
.nav-group             { flex: 1; flex-direction: row; align-items: center;
                         justify-content: flex-start; gap: 0.75rem; padding-left: 3rem; }
                         /* REMOVE: flex-direction: column, align-items: center (column behavior) */
.search-input          { width: 360px; padding: 0.5rem 2rem 0.5rem 0.75rem; }
.search-input:focus    { border-color: var(--color-cncf-blue);
                         box-shadow: 0 0 0 2px var(--color-cncf-blue); }
.search-count          { position: absolute; right: 2rem; /* (was right: 0.5rem) */ }
.search-clear          { /* new — see cncf-layout skill for full rule */ }

/* Mobile breakpoint — add this block */
@media (max-width: 768px) {
  .header-inner  { flex-wrap: wrap; gap: 0.75rem; }
  .nav-group     { order: 3; flex: 1 1 100%; justify-content: flex-start; padding-left: 0; }
  .header-actions { order: 2; margin-left: auto; }
  .header-left   { order: 1; }
  .search-input  { width: 100%; }
  .nav-group .search-wrapper { flex: 1; }
  .nav-group .site-switcher  { padding: 1px; }
  .nav-group .switcher-pill  { padding: 0.2rem 0.55rem; font-size: 0.75rem; }
}
```

#### CSS variables (`src/styles/variables.css` or equivalent)

Add if missing:
```css
--color-accent-emphasis: #0969da;   /* light */
--color-text-tertiary: #6e7781;     /* light */
/* dark theme: */
--color-accent-emphasis: #2f81f7;
--color-text-tertiary: #8b949e;
```

### Tests to add after migration

Copy `tests/e2e/header.spec.ts` from `castrojo/projects-website` and update:
- Line with `"CNCF Projects"` → `"CNCF People"` (or whatever this site's title is)
- `activeSite="projects"` pill check → `activeSite="people"`
- Section-nav tab count/labels to match people-website tabs
- Base URL in playwright.config.ts
