import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('TAB_CATEGORY_MAP', () => {
  it('maps ambassadors to the ambassadors category', async () => {
    const { TAB_CATEGORY_MAP } = await import('../../src/lib/tabs');
    expect(TAB_CATEGORY_MAP['ambassadors']).toBe('ambassadors');
  });

  it('maps kubestronauts to kubestronaut category', async () => {
    const { TAB_CATEGORY_MAP } = await import('../../src/lib/tabs');
    expect(TAB_CATEGORY_MAP['kubestronauts']).toBe('kubestronaut');
  });

  it('maps toc to technical oversight committee', async () => {
    const { TAB_CATEGORY_MAP } = await import('../../src/lib/tabs');
    expect(TAB_CATEGORY_MAP['toc']).toBe('technical oversight committee');
  });

  it('maps tab to end user tab', async () => {
    const { TAB_CATEGORY_MAP } = await import('../../src/lib/tabs');
    expect(TAB_CATEGORY_MAP['tab']).toBe('end user tab');
  });

  it('maps governing-board to governing board', async () => {
    const { TAB_CATEGORY_MAP } = await import('../../src/lib/tabs');
    expect(TAB_CATEGORY_MAP['governing-board']).toBe('governing board');
  });

  it('maps staff to staff', async () => {
    const { TAB_CATEGORY_MAP } = await import('../../src/lib/tabs');
    expect(TAB_CATEGORY_MAP['staff']).toBe('staff');
  });
});

describe('ALPHA_TABS', () => {
  it('includes toc', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('toc')).toBe(true);
  });

  it('includes tab', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('tab')).toBe(true);
  });

  it('includes governing-board', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('governing-board')).toBe(true);
  });

  it('includes staff', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('staff')).toBe(true);
  });

  it('includes maintainers', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('maintainers')).toBe(true);
  });

  it('includes marketing', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('marketing')).toBe(true);
  });

  it('includes emeritus', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('emeritus')).toBe(true);
  });

  it('does not include everyone', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('everyone')).toBe(false);
  });

  it('does not include ambassadors', async () => {
    const { ALPHA_TABS } = await import('../../src/lib/tabs');
    expect(ALPHA_TABS.has('ambassadors')).toBe(false);
  });
});

describe('applyTab', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="timeline-feed">
        <article class="person-card" data-categories="kubestronaut" style="display:''"></article>
        <article class="person-card" data-categories="ambassadors" style="display:''"></article>
        <section class="day-group">
          <article class="person-card" data-categories="kubestronaut" style="display:''"></article>
        </section>
      </div>
      <div id="memorial-feed"></div>
      <div id="maintainer-feed"></div>
      <div class="alpha-feed" data-alpha-tab="toc"></div>
      <div class="alpha-feed" data-alpha-tab="staff"></div>
      <div id="maintainer-summary"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows timeline and hides memorial/maintainer for "everyone" tab', async () => {
    const { applyTab } = await import('../../src/lib/tabs');
    applyTab('everyone');
    const tf = document.getElementById('timeline-feed')!;
    const mf = document.getElementById('memorial-feed')!;
    const maint = document.getElementById('maintainer-feed')!;
    expect(tf.style.display).not.toBe('none');
    expect(mf.style.display).toBe('none');
    expect(maint.style.display).toBe('none');
  });

  it('shows memorial feed and hides timeline for "memorial" tab', async () => {
    const { applyTab } = await import('../../src/lib/tabs');
    applyTab('memorial');
    expect(document.getElementById('timeline-feed')!.style.display).toBe('none');
    expect(document.getElementById('memorial-feed')!.style.display).not.toBe('none');
    expect(document.getElementById('maintainer-feed')!.style.display).toBe('none');
  });

  it('shows maintainer feed and hides timeline for "maintainers" tab', async () => {
    const { applyTab } = await import('../../src/lib/tabs');
    applyTab('maintainers');
    expect(document.getElementById('timeline-feed')!.style.display).toBe('none');
    expect(document.getElementById('maintainer-feed')!.style.display).not.toBe('none');
    expect(document.getElementById('memorial-feed')!.style.display).toBe('none');
  });

  it('shows the matching alpha feed and hides timeline for "toc" tab', async () => {
    const { applyTab } = await import('../../src/lib/tabs');
    applyTab('toc');
    const tocFeed = document.querySelector<HTMLElement>('.alpha-feed[data-alpha-tab="toc"]')!;
    const staffFeed = document.querySelector<HTMLElement>('.alpha-feed[data-alpha-tab="staff"]')!;
    expect(document.getElementById('timeline-feed')!.style.display).toBe('none');
    expect(tocFeed.style.display).not.toBe('none');
    expect(staffFeed.style.display).toBe('none');
  });

  it('filters person-cards by category for "ambassadors" tab', async () => {
    const { applyTab } = await import('../../src/lib/tabs');
    applyTab('ambassadors');
    const cards = document.querySelectorAll<HTMLElement>('.person-card');
    // cards[0] = kubestronaut, cards[1] = ambassadors, cards[2] = kubestronaut (in day-group)
    expect(cards[0].style.display).toBe('none');
    expect(cards[1].style.display).toBe('');
  });

  it('shows all person-cards for "everyone" tab', async () => {
    const { applyTab } = await import('../../src/lib/tabs');
    applyTab('everyone');
    const cards = document.querySelectorAll<HTMLElement>('.person-card');
    cards.forEach(card => expect(card.style.display).toBe(''));
  });

  it('shows maintainer-summary for maintainers tab, hides otherwise', async () => {
    const { applyTab } = await import('../../src/lib/tabs');
    const summary = document.getElementById('maintainer-summary')!;
    applyTab('maintainers');
    expect(summary.style.display).not.toBe('none');
    applyTab('everyone');
    expect(summary.style.display).toBe('none');
  });
});
