// tabs.ts — tab filtering logic extracted from PeopleLayout.astro.
// All DOM interaction uses document globals (available in browser + jsdom test env).

export const TAB_CATEGORY_MAP: Record<string, string> = {
  'ambassadors':     'ambassadors',
  'kubestronauts':   'kubestronaut',
  'toc':             'technical oversight committee',
  'tab':             'end user tab',
  'governing-board': 'governing board',
  'staff':           'staff',
};

export const ALPHA_TABS = new Set<string>([
  'toc', 'tab', 'governing-board', 'staff', 'maintainers', 'marketing', 'emeritus',
]);

export function applyTab(tab: string): void {
  const timelineFeed    = document.getElementById('timeline-feed');
  const alphaFeeds      = document.querySelectorAll<HTMLElement>('.alpha-feed');
  const memorialFeed    = document.getElementById('memorial-feed');
  const maintainerFeed  = document.getElementById('maintainer-feed');
  const maintainerSummary = document.getElementById('maintainer-summary');

  document.querySelectorAll<HTMLElement>('[data-tab-heroes]').forEach(el => {
    el.style.display = el.dataset.tabHeroes === tab ? '' : 'none';
  });

  if (maintainerSummary) maintainerSummary.style.display = tab === 'maintainers' ? '' : 'none';

  if (tab === 'memorial') {
    if (timelineFeed)  timelineFeed.style.display  = 'none';
    if (memorialFeed)  memorialFeed.style.display   = '';
    if (maintainerFeed) maintainerFeed.style.display = 'none';
    alphaFeeds.forEach(f => { f.style.display = 'none'; });

  } else if (tab === 'maintainers') {
    if (timelineFeed)  timelineFeed.style.display   = 'none';
    if (memorialFeed)  memorialFeed.style.display    = 'none';
    if (maintainerFeed) maintainerFeed.style.display = '';
    alphaFeeds.forEach(f => { f.style.display = 'none'; });

  } else if (ALPHA_TABS.has(tab)) {
    if (timelineFeed)  timelineFeed.style.display   = 'none';
    if (memorialFeed)  memorialFeed.style.display    = 'none';
    if (maintainerFeed) maintainerFeed.style.display = 'none';
    alphaFeeds.forEach(f => {
      f.style.display = f.dataset.alphaTab === tab ? '' : 'none';
    });

  } else {
    if (memorialFeed)  memorialFeed.style.display    = 'none';
    if (maintainerFeed) maintainerFeed.style.display = 'none';
    if (timelineFeed)  timelineFeed.style.display     = '';
    alphaFeeds.forEach(f => { f.style.display = 'none'; });

    const cards  = timelineFeed?.querySelectorAll<HTMLElement>('.person-card') ?? [];
    const groups = timelineFeed?.querySelectorAll<HTMLElement>('.day-group')   ?? [];

    cards.forEach(card => {
      if (tab === 'everyone') {
        card.style.display = '';
      } else {
        const cats   = (card.dataset.categories ?? '').split('|');
        const tabCat = TAB_CATEGORY_MAP[tab] ?? tab;
        card.style.display = cats.includes(tabCat) ? '' : 'none';
      }
    });

    groups.forEach(group => {
      const visible = Array.from(group.querySelectorAll<HTMLElement>('.person-card'))
        .some(c => c.style.display !== 'none');
      group.style.display = visible ? '' : 'none';
    });
  }
}

export function initTabs(): void {
  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.section-link[data-tab]');

    function activateTab(tab: string): void {
      buttons.forEach(b => b.classList.remove('active'));
      const target = Array.from(buttons).find(b => b.dataset.tab === tab);
      if (target) target.classList.add('active');
      applyTab(tab);
      document.querySelectorAll<HTMLElement>('[data-tab-summary]').forEach(el => {
        el.style.display = el.dataset.tabSummary === tab ? '' : 'none';
      });
      localStorage.setItem('active-tab', tab);
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab ?? 'everyone'));
    });

    const saved = localStorage.getItem('active-tab') ?? 'everyone';
    activateTab(saved);
  });
}
