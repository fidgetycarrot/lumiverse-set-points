import type { WebStoryPage } from './types';

export const WEB_IMPORT_LIMITS = { pages: 100, characters: 500_000 } as const;
export type WebCollectionReason = 'single-page' | 'no-next' | 'provided-pages' | 'ambiguous' | 'loop' | 'duplicate-text' | 'page-limit' | 'character-limit' | 'fetch-error' | 'cancelled' | 'invalid-url';
export interface WebCollection {
  pages: WebStoryPage[];
  text: string;
  reason: WebCollectionReason;
  message: string;
  stoppedAt?: string;
}
export interface WebCollectionProgress {
  pages: readonly WebStoryPage[];
  characters: number;
  loadingUrl: string | null;
}
export interface WebCollectionOptions {
  url: string;
  /** Subsequent pages in reading order. A supplied nonempty list replaces next-link discovery. */
  otherUrls?: string[];
  linked?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: WebCollectionProgress) => void;
  /** Lower limits are useful for testing; production ceilings cannot be raised. */
  maxPages?: number;
  maxCharacters?: number;
}
export type StoryPageFetcher = (url: string, signal: AbortSignal) => Promise<WebStoryPage>;

/** A syntactic guard; the backend applies its own URL and response checks. */
export function publicPageUrl(value: string, origin?: string): string {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Enter a complete public HTTP or HTTPS story link.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a complete public HTTP or HTTPS story link.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use public HTTP or HTTPS links without embedded credentials.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || /\.(local|localhost|internal|lan|home)$/.test(host) || host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error('Page collection accepts public website names. Paste text for local or private sources.');
  // Match the backend's narrow canonicalization for English Literotica story URLs.
  if (['literotica.com', 'www.literotica.com'].includes(host) && !url.port && url.pathname.startsWith('/s/')) {
    url.protocol = 'https:';
    url.hostname = 'www.literotica.com';
  }
  if (origin && url.origin !== origin) throw new Error('All collected pages must use the same website, protocol, and port as the first link.');
  url.hash = '';
  return url.href;
}

function cancelled(): Error { const error = new Error('Page loading cancelled.'); error.name = 'AbortError'; return error; }
/** Stops waiting immediately even when the transport cannot cancel an active request. */
async function withAbort<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  if (signal.aborted) throw cancelled();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw cancelled();
      return operation();
    }).then(value => { if (!signal.aborted) resolve(value); }, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
function bounded(value: number | undefined, ceiling: number) {
  return value === undefined || !Number.isFinite(value) ? ceiling : Math.min(ceiling, Math.max(1, Math.floor(value)));
}
function copyPage(page: WebStoryPage): WebStoryPage {
  return { title: page.title, text: page.text, url: page.url, nextPages: page.nextPages.map(link => ({ title: link.title, url: link.url })) };
}

/** Collects only an explicit sequence or an unambiguous chain of next-page links. */
export async function collectStoryPages(options: WebCollectionOptions, fetchPage: StoryPageFetcher): Promise<WebCollection> {
  const pages: WebStoryPage[] = [];
  let text = '';
  const signal = options.signal ?? new AbortController().signal;
  const seenUrls = new Set<string>();
  const seenText = new Set<string>();
  const maxPages = bounded(options.maxPages, WEB_IMPORT_LIMITS.pages);
  const maxCharacters = bounded(options.maxCharacters, WEB_IMPORT_LIMITS.characters);
  const explicit = options.linked && Boolean(options.otherUrls?.length);
  const supplied = explicit ? [...options.otherUrls!] : [];
  let origin: string;
  let nextUrl: string;
  const finish = (reason: WebCollectionReason, message: string, stoppedAt?: string): WebCollection => ({ pages: pages.map(copyPage), text, reason, message, ...(stoppedAt ? { stoppedAt } : {}) });
  const progress = (loadingUrl: string | null) => {
    if (!signal.aborted) options.onProgress?.({ pages: pages.map(copyPage), characters: text.length, loadingUrl });
  };
  if (signal.aborted) return finish('cancelled', 'Loading cancelled. No pages were added.');
  try { nextUrl = publicPageUrl(options.url); origin = new URL(nextUrl).origin; }
  catch (error) { return finish('invalid-url', error instanceof Error ? error.message : 'The first link could not be read.'); }

  while (true) {
    if (signal.aborted) return finish('cancelled', pages.length ? 'Loading cancelled. Collected pages are available below.' : 'Loading cancelled. No pages were added.');
    try { nextUrl = publicPageUrl(nextUrl, origin); }
    catch (error) { return finish('invalid-url', error instanceof Error ? error.message : 'The next link could not be read.'); }
    if (seenUrls.has(nextUrl)) return finish('loop', 'A page link repeats an earlier page. Stopped before reading it again.', nextUrl);
    if (pages.length >= maxPages) return finish('page-limit', `Reached the ${maxPages}-page limit. The remaining pages were not loaded.`, nextUrl);
    progress(nextUrl);
    let page: WebStoryPage;
    try {
      const fetched = await withAbort(signal, () => fetchPage(nextUrl, signal));
      if (signal.aborted) return finish('cancelled', pages.length ? 'Loading cancelled. Collected pages are available below.' : 'Loading cancelled. No pages were added.');
      if (!fetched || typeof fetched.title !== 'string' || typeof fetched.text !== 'string' || !fetched.text.trim() || !Array.isArray(fetched.nextPages)) throw new Error('The page returned no readable story text.');
      let resolved: string;
      try { resolved = publicPageUrl(fetched.url, origin); }
      catch { return finish('invalid-url', 'The returned page is outside the original website or is not a public link. The page was not added.', nextUrl); }
      if (seenUrls.has(resolved)) return finish('loop', 'The page resolved to an earlier page. Stopped without adding it again.', resolved);
      page = { title: fetched.title.trim() || `Page ${pages.length + 1}`, text: fetched.text.trim(), url: resolved, nextPages: fetched.nextPages.filter(link => link && typeof link.url === 'string').map(link => ({ title: typeof link.title === 'string' ? link.title : '', url: link.url })) };
    } catch (error) {
      if (signal.aborted) return finish('cancelled', pages.length ? 'Loading cancelled. Collected pages are available below.' : 'Loading cancelled. No pages were added.');
      const detail = error instanceof Error ? error.message : 'The website did not return a readable page.';
      return finish('fetch-error', `Could not read ${pages.length ? 'the next' : 'the first'} page. ${detail}`, nextUrl);
    }
    const fingerprint = page.text.replace(/\s+/g, ' ').toLowerCase();
    if (seenText.has(fingerprint)) return finish('duplicate-text', 'This page repeats story text already collected. Stopped without adding the duplicate.', page.url);
    const separator = `${pages.length ? '\n\n' : ''}--- Page ${pages.length + 1}: ${page.title.replace(/\s+/g, ' ').slice(0, 300)} ---\n${page.url}\n\n`;
    if (text.length + separator.length + page.text.length > maxCharacters) return finish('character-limit', `The next page would exceed the ${maxCharacters.toLocaleString('en-US')}-character limit. That page was not added.`, page.url);
    seenUrls.add(nextUrl); seenUrls.add(page.url); seenText.add(fingerprint);
    pages.push(page); text += separator + page.text; progress(null);
    if (signal.aborted) return finish('cancelled', pages.length ? 'Loading cancelled. Collected pages are available below.' : 'Loading cancelled. No pages were added.');
    if (!options.linked) return finish('single-page', 'One page loaded. Check whether the story continues on another page.');
    if (explicit) {
      const suppliedUrl = supplied.shift();
      if (!suppliedUrl) return finish('provided-pages', 'Reached the end of your supplied page links. Check story completeness.');
      nextUrl = suppliedUrl;
      continue;
    }
    const candidates = new Map<string, string>();
    for (const link of page.nextPages) {
      try { const normalized = publicPageUrl(link.url, origin); candidates.set(normalized, normalized); }
      catch { return finish('invalid-url', 'A next-page link is outside the original website or is not a public link. Check the page links before continuing.'); }
    }
    if (candidates.size === 0) return finish('no-next', 'No next-page link found; check completeness.');
    if (candidates.size > 1) return finish('ambiguous', 'More than one next-page link was found. Supply every page after the first in reading order, including pages already collected, then read again.');
    nextUrl = candidates.values().next().value!;
  }
}
