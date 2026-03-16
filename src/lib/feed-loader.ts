// feed-loader.ts
// Progressively loads and renders person cards from the static changelog.json.
// The first STATIC_COUNT cards are already in the DOM as server-rendered HTML.
// This module fetches the rest and appends them in batches via IntersectionObserver.

const BASE = (document.documentElement.dataset.base ?? '/people-website').replace(/\/$/, '');
const DATA_URL = `${BASE}/data/changelog.json`;
const BATCH_SIZE = 50;

interface Change { field: string; from: string; to: string; }
interface Person {
  name: string; handle?: string; github?: string; imageUrl?: string;
  bio?: string; pronouns?: string; company?: string; companyLandscapeUrl?: string;
  location?: string; linkedin?: string; twitter?: string; youtube?: string;
  website?: string; bluesky?: string; mastodon?: string; certDirectory?: string;
  category: string[]; projects?: string[];
  avatarUrl?: string;
  contributions?: number;
  publicRepos?: number;
  yearsContributing?: number;
  countryFlag?: string;
  primaryBadge?: string;
}
interface Event { id: string; type: string; timestamp: string; person: Person; changes?: Change[]; }

const CATEGORY_MAP: Record<string, { name: string; color: string }> = {
  'Kubestronaut':                  { name: 'Kubestronaut',        color: 'var(--color-kubestronaut, #D62293)' },
  'Golden-Kubestronaut':           { name: '⭐ Golden Kubestronaut', color: 'var(--color-golden, #D4AF37)' },
  'Ambassadors':                   { name: 'Ambassador',           color: 'var(--color-ambassador, #0086FF)' },
  'Technical Oversight Committee': { name: 'TOC',                  color: 'var(--color-toc, #D62293)' },
  'End User TAB':                  { name: 'End User TAB',         color: 'var(--color-tab, #D62293)' },
  'Staff':                         { name: 'Staff',                color: 'var(--color-staff, #00A86B)' },
  'Governing Board':               { name: 'Governing Board',      color: 'var(--color-board, #E65100)' },
  'Marketing Committee':           { name: 'Marketing Committee',  color: 'var(--color-board, #E65100)' },
};

const PROGRAM_LOGOS: Record<string, string> = {
  'Kubestronaut':                  `${BASE}/program-logos/kubestronaut.svg`,
  'Golden-Kubestronaut':           `${BASE}/program-logos/golden-kubestronaut.svg`,
  'Ambassadors':                   `${BASE}/program-logos/ambassador.svg`,
  'Technical Oversight Committee': `${BASE}/program-logos/cncf.svg`,
  'End User TAB':                  `${BASE}/program-logos/cncf.svg`,
  'Staff':                         `${BASE}/program-logos/cncf.svg`,
};

const GH_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>`;
const LI_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
const TW_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
const YT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
const BSKY_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/></svg>`;
const CERT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`;

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderCard(e: Event, landscapeLogos: Record<string, string>): string {
  const p = e.person;
  const avatarSrc = p.avatarUrl || p.imageUrl || '';
  const profileUrl = p.github || (p.handle ? `https://github.com/${p.handle}` : '#');
  const cats = p.category ?? [];
  const primaryCat = cats[0] ?? '';
  // Use pre-computed primaryBadge from backend; fall back to category scan for older events
  const LOGO_PRIORITY = ['Golden-Kubestronaut','Kubestronaut','Ambassadors','Technical Oversight Committee','End User TAB','Staff'];
  const logoKey = p.primaryBadge
    ? (PROGRAM_LOGOS[p.primaryBadge] ? p.primaryBadge : undefined)
    : LOGO_PRIORITY.find(c => cats.includes(c));
  const accentKey = p.primaryBadge || LOGO_PRIORITY.find(c => cats.includes(c)) || primaryCat;
  const catInfo = CATEGORY_MAP[accentKey] ?? CATEGORY_MAP[primaryCat] ?? { name: primaryCat, color: '#888' };
  const programLogo = logoKey ? PROGRAM_LOGOS[logoKey] : '';
  const typeLabel = ({ added: '+ Joined', removed: '− Left', updated: '✎ Updated' } as Record<string,string>)[e.type] ?? e.type;
  const date = new Date(e.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  const formattedTime = date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZone:'UTC', timeZoneName:'short' });
  const year = new Date().getFullYear();

  const catBadges = cats.map(cat => {
    const ci = CATEGORY_MAP[cat] ?? catInfo;
    return `<span class="badge badge-category" style="background:${ci.color}22;color:${ci.color};border-color:${ci.color}44">${esc(ci.name ?? cat)}</span>`;
  }).join('');

  const statsRow = (p.contributions || p.publicRepos || p.yearsContributing) ? `
    <div class="stats-row">
      ${p.yearsContributing ? `<span class="stat-chip"><img src="${BASE}/program-logos/cncf.svg" alt="" class="stat-cncf-icon" aria-hidden="true" style="width:14px;height:14px;object-fit:contain;flex-shrink:0"><span class="stat-val">Since ${year - p.yearsContributing} (${p.yearsContributing}y)</span></span>` : ''}
      ${p.contributions ? `<span class="stat-chip"><span class="stat-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect width="16" height="2" rx="1" y="0"/><rect width="16" height="2" rx="1" y="4"/><rect width="16" height="2" rx="1" y="8"/><rect width="10" height="2" rx="1" y="12"/></svg></span><span class="stat-val">${p.contributions.toLocaleString()}</span><span class="stat-label">contributions</span></span>` : ''}
      ${p.publicRepos ? `<span class="stat-chip"><span class="stat-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="14" height="14" rx="2"/><path d="M4 8h8M4 5h8M4 11h5"/></svg></span><span class="stat-val">${p.publicRepos}</span><span class="stat-label">repos</span></span>` : ''}
    </div>` : '';

  const projectsRow = (p.projects?.length) ? `
    <div class="projects-row">${p.projects.map(proj => {
      const logo = landscapeLogos[proj] ?? landscapeLogos[proj.toLowerCase()] ?? '';
      return `<span class="project-chip">${logo ? `<img src="${esc(logo)}" alt="" class="project-logo" aria-hidden="true" loading="lazy" style="width:13px;height:13px;object-fit:contain;filter:grayscale(100%)" onerror="this.style.display='none'">` : ''}${esc(proj)}</span>`;
    }).join('')}</div>` : '';

  const changesHtml = e.changes?.length ? `
    <details class="changes-details">
      <summary class="changes-summary">${e.changes.length} field${e.changes.length > 1 ? 's' : ''} changed</summary>
      <ul class="changes-list">${e.changes.map(c =>
        `<li class="change-item"><span class="change-field">${esc(c.field)}</span><span class="change-from">${esc(c.from||'(empty)')}</span><span class="change-arrow">→</span><span class="change-to">${esc(c.to||'(empty)')}</span></li>`
      ).join('')}</ul>
    </details>` : '';

  const rightCol = (programLogo || p.location) ? `
    <div class="card-right">
      ${programLogo ? `<img src="${esc(programLogo)}" alt="${esc(logoKey??'')}" class="program-logo" loading="lazy" style="height:48px;width:auto;opacity:0.9">` : ''}
      ${p.location ? `<span class="location-right">${esc(p.countryFlag ?? '')} ${esc(p.location)}</span>` : ''}
    </div>` : '';

  const socialLinks = [
    p.certDirectory ? `<a href="${esc(p.certDirectory)}" target="_blank" rel="noopener noreferrer" class="social-link" title="CNCF Cert Directory" aria-label="CNCF Cert Directory">${CERT_ICON}</a>` : '',
    p.youtube       ? `<a href="${esc(p.youtube)}"       target="_blank" rel="noopener noreferrer" class="social-link" title="YouTube"            aria-label="YouTube">${YT_ICON}</a>` : '',
    p.github        ? `<a href="${esc(p.github)}"        target="_blank" rel="noopener noreferrer" class="social-link" title="GitHub"             aria-label="GitHub">${GH_ICON}</a>` : '',
    p.linkedin      ? `<a href="${esc(p.linkedin)}"      target="_blank" rel="noopener noreferrer" class="social-link" title="LinkedIn"           aria-label="LinkedIn">${LI_ICON}</a>` : '',
    p.twitter       ? `<a href="${esc(p.twitter)}"       target="_blank" rel="noopener noreferrer" class="social-link" title="Twitter/X"          aria-label="Twitter">${TW_ICON}</a>` : '',
    p.bluesky       ? `<a href="${esc(p.bluesky)}"       target="_blank" rel="noopener noreferrer" class="social-link" title="Bluesky"            aria-label="Bluesky">${BSKY_ICON}</a>` : '',
  ].join('');

  return `<article class="person-card" data-id="${esc(e.id)}" data-type="${esc(e.type)}" data-category="${esc(primaryCat.toLowerCase())}" data-categories="${esc(cats.map(c=>c.toLowerCase()).join('|'))}" style="--card-accent:${catInfo.color}">
  <div class="card-accent-bar"></div>
  <div class="card-body">
    <div class="card-main">
      <div class="card-identity">
        <a href="${esc(profileUrl)}" target="_blank" rel="noopener noreferrer" class="avatar-link">
          ${avatarSrc
            ? `<img src="${esc(avatarSrc)}" alt="${esc(p.name)}" class="avatar" loading="lazy" width="64" height="64">`
            : `<div class="avatar avatar-placeholder" aria-hidden="true">${esc(p.name.charAt(0))}</div>`}
        </a>
        <div class="identity-info">
          <div class="name-row">
            <a href="${esc(profileUrl)}" target="_blank" rel="noopener noreferrer" class="person-name">${esc(p.name)}</a>
            ${p.handle ? `<a href="${esc(profileUrl)}" target="_blank" rel="noopener noreferrer" class="handle">@${esc(p.handle)}</a>` : ''}
            ${p.pronouns ? `<span class="pronouns">(${esc(p.pronouns)})</span>` : ''}
          </div>
          ${p.company ? `<div class="company-row">${p.companyLandscapeUrl
            ? `<a href="${esc(p.companyLandscapeUrl)}" target="_blank" rel="noopener noreferrer" class="company-chip company-chip-link">${esc(p.company)}</a>`
            : `<span class="company-chip">${esc(p.company)}</span>`}</div>` : ''}
          ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
          <div class="badges">
            <span class="badge badge-${esc(e.type)}">${esc(typeLabel)}</span>
            ${catBadges}
          </div>
        </div>
      </div>
      ${statsRow}
      ${projectsRow}
      ${changesHtml}
    </div>
    ${rightCol}
  </div>
  <div class="card-footer">
    <time datetime="${esc(e.timestamp)}" class="timestamp">${esc(formattedDate)} · ${esc(formattedTime)}</time>
    <div class="social-links">${socialLinks}</div>
  </div>
</article>`;
}

function dateHeader(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'UTC' });
}

export async function initFeedLoader(staticCount: number, landscapeLogos: Record<string, string>, onBatchLoaded?: () => void) {
  const feed = document.getElementById('timeline-feed');
  if (!feed) return;

  let allEvents: Event[] = [];
  let nextIdx = staticCount;
  let loading = false;
  let done = false;

  async function loadData() {
    const res = await fetch(DATA_URL);
    allEvents = await res.json() as Event[];
    done = nextIdx >= allEvents.length;
  }

  function appendBatch() {
    if (loading || done) return;
    loading = true;

    const batch = allEvents.slice(nextIdx, nextIdx + BATCH_SIZE);
    nextIdx += batch.length;
    done = nextIdx >= allEvents.length;

    for (const e of batch) {
      const header = dateHeader(e.timestamp);
      let group = feed.querySelector<HTMLElement>(`.day-group[data-date="${CSS.escape(header)}"]`);
      if (!group) {
        group = document.createElement('section');
        group.className = 'day-group';
        group.dataset.date = header;
        group.innerHTML = `<h2 class="day-header">${esc(header)}</h2>`;
        feed.insertBefore(group, sentinel);
      }
      group.insertAdjacentHTML('beforeend', renderCard(e, landscapeLogos));
    }

    loading = false;
    onBatchLoaded?.();
    if (done) observer.disconnect();
  }

  const sentinel = document.createElement('div');
  sentinel.id = 'feed-sentinel';
  feed.appendChild(sentinel);

  await loadData();

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) appendBatch();
  }, { rootMargin: '400px' });

  observer.observe(sentinel);
  // Kick off first batch immediately in case sentinel is already visible
  appendBatch();
}
