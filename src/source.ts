import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { WebPageLink, WebStoryPage } from './types';

export function storyUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Enter a story page URL.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a complete https:// story URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a public HTTP or HTTPS page without embedded credentials.');
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error('Link import accepts public website names. Paste text for local or private sources.');
  // The English site's bare host redirects to www. Normalize before fetching so
  // its absolute pagination links keep the same origin. Language hosts stay put.
  if (['literotica.com', 'www.literotica.com'].includes(host) && !url.port && url.pathname.startsWith('/s/')) {
    url.protocol = 'https:';
    url.hostname = 'www.literotica.com';
  }
  url.hash = '';
  return url.href;
}

type ParsedDocument = ReturnType<typeof parseHTML>['document'];
type ParsedElement = ReturnType<ParsedDocument['querySelectorAll']>[number];

function isPagination(element: ParsedElement): boolean {
  for (let parent: ParsedElement | null = element; parent; parent = parent.parentElement) {
    const marker = `${parent.id} ${parent.className}`;
    const label = parent.getAttribute('aria-label') ?? '';
    if (/(?:^|[\s_-])(?:pagination|paginator|pager|page[-_]?nav(?:igation)?|chapter[-_]?nav(?:igation)?|story[-_]?nav(?:igation)?)(?:$|[\s_-])/i.test(marker)
      || /\b(?:pagination|(?:page|chapter|story)\s+navigation|navigation\s+(?:for\s+)?(?:pages|chapters|stories))\b/i.test(label)) return true;
  }
  return false;
}

function unrelatedNavigation(element: ParsedElement): boolean {
  for (let parent: ParsedElement | null = element; parent; parent = parent.parentElement) {
    const marker = `${parent.id} ${parent.className} ${parent.getAttribute('aria-label') ?? ''}`;
    if (/(?:^|[\s_-])(?:comments?|recommendations?|recommended|related|advertisements?|social|share)(?:$|[\s_-])/i.test(marker)) return true;
  }
  return false;
}

function candidateUrl(href: string, source: URL): string | null {
  if (!href.trim() || href.trim().startsWith('#')) return null;
  try {
    const normalized = storyUrl(new URL(href, source).href);
    const parsed = new URL(normalized);
    if (parsed.origin !== source.origin || normalized === source.href) return null;
    const path = decodeURIComponent(parsed.pathname);
    if (/\.(?:pdf|epub|mobi|azw3?|zip|rar|7z|tar|gz|exe|dmg|apk|docx?|rtf|mp3|mp4|webm|jpe?g|png|gif|svg|webp)$/i.test(path)) return null;
    if (/(?:^|\/)(?:downloads?|attachments?|log(?:in|out)|sign(?:in|out|up)|register|registration|account|auth|oauth|password|subscribe|subscription|comments?|recommendations?|related|toc|contents)(?:[/.;]|$)/i.test(path)) return null;
    for (const [key, value] of parsed.searchParams) {
      if (/^(?:download|attachment)$/i.test(key)
        || /^(?:action|mode|view)$/i.test(key) && /^(?:download|login|signin|register|comments|print)$/i.test(value)
        || /^format$/i.test(key) && /^(?:pdf|epub|mobi|docx?|zip)$/i.test(value)) return null;
    }
    return normalized;
  } catch { return null; }
}

function literoticaNextPage(element: ParsedElement, target: URL, source: URL): boolean {
  if (!(source.hostname === 'literotica.com' || source.hostname.endsWith('.literotica.com'))
    || !/^\/s\/[^/]+\/?$/.test(source.pathname) || source.pathname !== target.pathname) return false;
  // Current site: nav._pagination_* and a._pagination__item_* (formerly l_bJ).
  // Recognize an existing link to the immediate successor, including SVG arrows;
  // never invent page URLs from a last-page number or walk unrelated series.
  const inCurrentPager = !!element.closest('nav[class*="_pagination_"]');
  const oldNextArrow = element.classList.contains('b-pager-next');
  if (!inCurrentPager && !oldNextArrow) return false;
  const currentValues = source.searchParams.getAll('page');
  const targetValues = target.searchParams.getAll('page');
  if (currentValues.length > 1 || targetValues.length !== 1) return false;
  const currentValue = currentValues[0] ?? '1';
  const targetValue = targetValues[0]!;
  if (!/^[1-9]\d*$/.test(currentValue) || !/^[1-9]\d*$/.test(targetValue)) return false;
  const currentPage = Number(currentValue), targetPage = Number(targetValue);
  if (!Number.isSafeInteger(currentPage) || !Number.isSafeInteger(targetPage) || targetPage !== currentPage + 1) return false;
  const otherParams = (url: URL) => [...url.searchParams].filter(([key]) => key !== 'page').sort(([a,b],[c,d]) => a.localeCompare(c) || b.localeCompare(d));
  return JSON.stringify(otherParams(source)) === JSON.stringify(otherParams(target));
}

/** Discover possible successors without fetching them or treating unrelated links as chapters. */
function nextPages(document: ParsedDocument, sourceUrl: string): WebPageLink[] {
  const source = new URL(storyUrl(sourceUrl));
  const candidates = new Map<string, { url: string; title: string; rank: number }>();
  for (const element of document.querySelectorAll('a[href],link[href][rel]')) {
    if (element.hasAttribute('download') || element.getAttribute('aria-disabled') === 'true' || unrelatedNavigation(element)) continue;
    const rel = (element.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('prev') || rel.includes('previous')) continue;
    const labels = [element.textContent, element.getAttribute('aria-label'), element.getAttribute('title')]
      .map(value => (value ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (labels.some(label => /^(?:[←‹«]\s*)?(?:prev(?:ious)?\.?\b|back\s+to\b|table\s+of\s+contents\b|contents\b|toc\b|comments?\b|recommended\b|related\b)/i.test(label))) continue;
    const explicit = labels.find(label => /\bnext\s+(?:(?:story|chapter)\s+)?(?:page|chapter|part|installment|section)\b|\bcontinue\s+(?:the\s+)?story\b/i.test(label));
    const contextual = isPagination(element) && labels.find(label => /^(?:next(?:\s+(?:page|chapter|part))?|continue(?:\s+reading)?|[›»→▶]+)\s*[›»→▶]*$/i.test(label));
    const target = candidateUrl(element.getAttribute('href') ?? '', source);
    if (!target) continue;
    const numbered = literoticaNextPage(element, new URL(target), source);
    const rank = rel.includes('next') ? 3 : explicit || numbered ? 2 : contextual ? 1 : 0;
    if (!rank) continue;
    const label = explicit || contextual || (numbered ? `Page ${new URL(target).searchParams.get('page')}` : labels.find(text => !/^[\W_]+$/u.test(text))) || 'Next page';
    const title = label.length > 200 ? `${label.slice(0,197)}…` : label;
    const previous = candidates.get(target);
    if (!previous || rank > previous.rank || previous.title === 'Next page' && title !== 'Next page') {
      candidates.set(target, { url: target, title, rank: Math.max(rank, previous?.rank ?? 0) });
    }
  }
  const ranked = [...candidates.values()];
  // rel=next expresses the document relationship explicitly. Weaker sidebar labels
  // must not turn a clear successor into an ambiguous set of guesses.
  const hasRelNext = ranked.some(candidate => candidate.rank === 3);
  return ranked.filter(candidate => !hasRelNext || candidate.rank === 3)
    .sort((a,b) => b.rank - a.rank).map(({url,title}) => ({url,title}));
}

export function extractPage(response: unknown, url: string): WebStoryPage {
  url = storyUrl(url);
  if (!response || typeof response !== 'object') throw new Error('The site returned an unreadable response. Paste the story text instead.');
  const { status, headers, body } = response as { status?: number; headers?: Record<string, string>; body?: string };
  if (!status || status < 200 || status >= 300) throw new Error(`The site returned HTTP ${status ?? 'unknown'}. Paste the story text instead.`);
  if (typeof body !== 'string' || !body.trim()) throw new Error('The page was empty. Paste the story text instead.');
  if (body.length > 3_000_000) throw new Error('This page is too large. Paste a chapter or upload the story as text.');
  const type = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1]?.toLowerCase() ?? '';
  let title = new URL(url).hostname;
  let text = '';
  let successors: WebPageLink[] = [];
  if (type.includes('text/plain')) text = body.trim();
  else {
    if (type && !type.includes('html') && !type.includes('text/')) throw new Error('Link import supports readable web pages. Upload a text file for this source.');
    // A detached parser never executes scripts, follows links, or loads assets.
    const { document } = parseHTML(body);
    // Chapter navigation commonly lives in the header, footer, or nav that we
    // deliberately remove from story prose. Inspect it first, without loading it.
    successors = nextPages(document, url);
    document.querySelectorAll('script,style,iframe,object,embed,form,nav,footer,header,noscript').forEach(node => node.remove());
    const parsed = new Readability(document as unknown as Document, { maxElemsToParse: 40000, charThreshold: 100 }).parse();
    if (!parsed?.content) throw new Error('No readable story was found. The site may require login or scripts. Paste the text instead.');
    const content = parseHTML(`<html><body>${parsed.content}</body></html>`).document;
    content.querySelectorAll('p,div,section,article,h1,h2,h3,h4,li,blockquote,br').forEach(node => { node.appendChild(content.createTextNode('\n\n')); });
    text = (content.body.textContent ?? '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    title = parsed.title?.trim() || title;
  }
  if (text.length < 100) throw new Error('Too little story text was found. Paste the text instead.');
  if (text.length > 500_000) throw new Error('The extracted text exceeds 500,000 characters. Import a shorter section.');
  return { title, text, url, nextPages: successors };
}
