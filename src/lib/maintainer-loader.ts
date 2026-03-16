// maintainer-loader.ts
// Progressively loads and renders maintainer cards from the static maintainers.json.
// The first staticCount cards are already in the DOM as server-rendered HTML.
// This module fetches the rest and appends them in batches via IntersectionObserver.

const BASE = (document.documentElement.dataset.base ?? '/people-website').replace(/\/$/, '');
const MAINTAINERS_URL = `${BASE}/data/maintainers.json`;
const LOGOS_URL = `${BASE}/data/landscape_logos.json`;
const BATCH_SIZE = 50;

interface ProjectDetail {
  name: string;
  maturity: string;
}

interface SafeMaintainer {
  name: string;
  handle: string;
  company?: string;
  location?: string;
  countryFlag?: string;
  bio?: string;
  projects: string[];
  projectDetails?: ProjectDetail[];
  maturity: string;
  ownersUrl?: string;
  logoUrl?: string;
  yearsContributing?: number;
}

const MATURITY_COLOR: Record<string, string> = {
  'Graduated':  '#FFB300',
  'Incubating': '#0086FF',
  'Sandbox':    '#8b949e',
};

function resolveLogoUrl(project: string, logos: Record<string, string>): string {
  const key = project.toLowerCase();
  if (logos[key]) return logos[key];
  // Strip ": subproject" (e.g. "Istio: Maintainers" → "Istio")
  const colonIdx = key.indexOf(':');
  if (colonIdx > 0) {
    const base = key.slice(0, colonIdx).trim();
    if (logos[base]) return logos[base];
  }
  // Strip "(parenthetical)"
  const parenIdx = key.indexOf('(');
  if (parenIdx > 0) {
    const base = key.slice(0, parenIdx).trim();
    if (logos[base]) return logos[base];
  }
  // Progressively strip trailing words ("Kubernetes Steering" → "Kubernetes")
  const parts = key.split(' ');
  for (let n = parts.length - 1; n > 0; n--) {
    const candidate = parts.slice(0, n).join(' ');
    if (logos[candidate]) return logos[candidate];
  }
  return '';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMaintainerCard(m: SafeMaintainer, logos: Record<string, string>): string {
  const profileUrl = `https://github.com/${esc(m.handle)}`;
  const avatarUrl  = `https://avatars.githubusercontent.com/${esc(m.handle)}?s=128`;
  const accentColor = MATURITY_COLOR[m.maturity] ?? '#8b949e';
  const cncfLogoUrl = `${BASE}/program-logos/cncf.svg`;
  const currentYear = new Date().getFullYear();

  // Use projectDetails for per-project maturity colors; fall back to projects list
  const chipProjects: ProjectDetail[] = m.projectDetails
    ?? m.projects.map(p => ({ name: p, maturity: m.maturity }));

  const projectChips = chipProjects.map(({ name: p, maturity: pm }) => {
    const chipColor = MATURITY_COLOR[pm] ?? '#8b949e';
    const logo = resolveLogoUrl(p, logos);
    const logoImg = logo ? `<img class="project-logo" src="${esc(logo)}" onerror="this.style.display='none'" loading="lazy" alt="" style="width:13px;height:13px;object-fit:contain;filter:grayscale(100%)">` : '';
    return `<span class="project-chip" style="--chip-accent:${chipColor}; border-color:${chipColor}33; background:${chipColor}11">${logoImg}${esc(p)}</span>`;
  }).join('');

  const logoTopRight = m.logoUrl
    ? `<img class="program-logo" src="${esc(m.logoUrl)}" alt="" aria-hidden="true" loading="lazy" />`
    : '';

  const locationHtml = (m.countryFlag || m.location)
    ? `<span class="location-right">${m.countryFlag ? esc(m.countryFlag) : ''} ${m.location ? esc(m.location) : ''}</span>`
    : '';

  const cardRight = (logoTopRight || locationHtml)
    ? `<div class="card-right">${logoTopRight}${locationHtml}</div>`
    : '';

  const company = m.company
    ? `<div class="company-row"><span class="company-chip">${esc(m.company)}</span></div>`
    : '';

  const bio = m.bio
    ? `<p class="bio">${esc(m.bio)}</p>`
    : '';

  const statsRow = (m.yearsContributing ?? 0) > 0
    ? `<div class="stats-row"><span class="stat-chip"><img src="${esc(cncfLogoUrl)}" class="stat-cncf-icon" alt="" aria-hidden="true"><span class="stat-val">Since ${currentYear - m.yearsContributing!} (${m.yearsContributing}y)</span></span></div>`
    : '';

  const maintainerBadge = `<span class="badge badge-category" style="background:#88888822; color:#888888; border-color:#88888844">Maintainer</span>`;

  return `<article class="maintainer-card" style="--card-accent: ${accentColor}">
  <div class="card-accent-bar"></div>
  <div class="card-body">
    <a href="${profileUrl}" class="avatar-link" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">
      <img class="avatar" src="${avatarUrl}" width="64" height="64" alt="${esc(m.name)}" loading="lazy" />
    </a>
    <div class="card-main">
      <div class="card-identity-row">
        <div class="identity-info">
          <div class="name-row">
            <a class="person-name" href="${profileUrl}" target="_blank" rel="noopener noreferrer">${esc(m.name)}</a>
            <a class="handle" href="${profileUrl}" target="_blank" rel="noopener noreferrer">@${esc(m.handle)}</a>
          </div>
          ${company}
          ${bio}
          <div class="badges">${maintainerBadge}</div>
        </div>
        ${cardRight}
      </div>
      ${statsRow}
      <div class="projects-row">${projectChips}</div>
    </div>
  </div>
</article>`;
}

export async function initMaintainerLoader(staticCount: number, preloadedLogos?: Record<string, string>) {
  const feed = document.getElementById('maintainer-feed');
  if (!feed) return;

  let allMaintainers: SafeMaintainer[] = [];
  let logos: Record<string, string> = preloadedLogos ?? {};
  let nextIdx = staticCount;
  let loading = false;
  let done = false;

  async function loadData() {
    const [maintainersRes, logosRes] = await Promise.all([
      fetch(MAINTAINERS_URL),
      preloadedLogos ? null : fetch(LOGOS_URL).catch(() => null),
    ]);
    allMaintainers = await maintainersRes.json() as SafeMaintainer[];
    if (!preloadedLogos && logosRes?.ok) {
      logos = await logosRes.json() as Record<string, string>;
    }
    done = nextIdx >= allMaintainers.length;
  }

  function appendBatch() {
    if (loading || done) return;
    loading = true;

    const batch = allMaintainers.slice(nextIdx, nextIdx + BATCH_SIZE);
    nextIdx += batch.length;
    done = nextIdx >= allMaintainers.length;

    for (const m of batch) {
      feed.insertAdjacentHTML('beforeend', renderMaintainerCard(m, logos));
    }

    loading = false;
    if (done) observer.disconnect();
  }

  const sentinel = document.createElement('div');
  sentinel.id = 'maintainer-sentinel';
  feed.appendChild(sentinel);

  await loadData();

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) appendBatch();
  }, { rootMargin: '400px' });

  observer.observe(sentinel);
  appendBatch();
}
