// search.ts — global people search; lazy-loads people-index.json on first keypress.
import MiniSearch from 'minisearch';
interface SafePerson {
  name: string; handle?: string; github?: string; imageUrl?: string; avatarUrl?: string;
  bio?: string; pronouns?: string; company?: string; location?: string; countryFlag?: string;
  primaryBadge?: string; category: string[]; projects?: string[];
  contributions?: number; yearsContributing?: number;
}
interface IndexedPerson extends SafePerson { id: number; categoryStr: string; }
export interface SearchResult extends SafePerson { score: number; terms: string[]; }
let miniSearch: MiniSearch | null = null;
let loadPromise: Promise<void> | null = null;
async function ensureLoaded(baseUrl: string): Promise<void> {
  if (miniSearch) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const url = `${baseUrl.replace(/\/$/, '')}/data/people-index.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load people-index.json: ${res.status}`);
    const people: SafePerson[] = await res.json();
    miniSearch = new MiniSearch<IndexedPerson>({
      fields: ['name', 'handle', 'company', 'location', 'bio', 'categoryStr'],
      storeFields: ['name', 'handle', 'github', 'imageUrl', 'avatarUrl', 'company',
                    'location', 'countryFlag', 'primaryBadge', 'category',
                    'pronouns', 'yearsContributing', 'contributions'],
      searchOptions: { fuzzy: 0.2, prefix: true, boost: { name: 3, handle: 2, company: 1.5 } },
    });
    const indexed: IndexedPerson[] = people.map((p, i) => ({ ...p, id: i, categoryStr: (p.category ?? []).join(' ') }));
    miniSearch.addAll(indexed);
  })();
  return loadPromise;
}
/** Search all people; returns up to `limit` results sorted by relevance. Lazy-loads the index. */
export async function searchPeople(query: string, baseUrl: string, limit = 50): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  await ensureLoaded(baseUrl);
  if (!miniSearch) return [];
  const raw = miniSearch.search(query);
  return raw.slice(0, limit).map(({ score, terms, category, ...rest }) => ({
    ...(rest as Omit<SearchResult, 'score' | 'terms' | 'category'>), score, terms,
    category: (category as string[] | undefined) ?? [],
  }));
}
/** Preload the search index in the background (call on page load to warm it up). */
export function preloadSearchIndex(baseUrl: string): void {
  ensureLoaded(baseUrl).catch(() => { /* silent — lazy load on first search */ });
}
