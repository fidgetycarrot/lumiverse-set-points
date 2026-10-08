import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export function storyUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Enter a story page URL.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a complete https:// story URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a public HTTP or HTTPS page without embedded credentials.');
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error('Link import accepts public website names. Paste text for local or private sources.');
  url.hash = '';
  return url.href;
}

export function extractPage(response: unknown, url: string): { title: string; text: string; url: string } {
  if (!response || typeof response !== 'object') throw new Error('The site returned an unreadable response. Paste the story text instead.');
  const { status, headers, body } = response as { status?: number; headers?: Record<string, string>; body?: string };
  if (!status || status < 200 || status >= 300) throw new Error(`The site returned HTTP ${status ?? 'unknown'}. Paste the story text instead.`);
  if (typeof body !== 'string' || !body.trim()) throw new Error('The page was empty. Paste the story text instead.');
  if (body.length > 3_000_000) throw new Error('This page is too large. Paste a chapter or upload the story as text.');
  const type = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1]?.toLowerCase() ?? '';
  let title = new URL(url).hostname;
  let text = '';
  if (type.includes('text/plain')) text = body.trim();
  else {
    if (type && !type.includes('html') && !type.includes('text/')) throw new Error('Link import supports readable web pages. Upload a text file for this source.');
    // A detached parser never executes scripts, follows links, or loads assets.
    const { document } = parseHTML(body);
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
  return { title, text, url };
}
