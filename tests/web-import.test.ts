import { describe, expect, test } from 'bun:test';
import { collectStoryPages, publicPageUrl } from '../src/web-import';
import type { WebStoryPage } from '../src/types';

const link = (page: number) => `https://stories.example/read/${page}`;
function page(index: number, next: number[] = []): WebStoryPage {
  return { title: `Chapter ${index}`, text: `This is the distinct story prose for chapter ${index}.`, url: link(index), nextPages: next.map(value => ({ title: `Next ${value}`, url: link(value) })) };
}
function fixture(...pages: WebStoryPage[]) {
  const called: string[] = [];
  return { called, fetch: async (url: string) => { called.push(url); const found = pages.find(item => item.url === url); if (!found) throw new Error('Site unavailable'); return found; } };
}

describe('linked story page collection', () => {
  test('follows a unique next-page chain in order and reports the uncertain endpoint', async () => {
    const source = fixture(page(1, [2]), page(2, [3]), page(3)); const counts: number[] = [];
    const result = await collectStoryPages({ url: link(1), linked: true, onProgress: progress => counts.push(progress.pages.length) }, source.fetch);
    expect(source.called).toEqual([link(1), link(2), link(3)]); expect(result.pages.map(item => item.title)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
    expect(result.text.indexOf('chapter 1')).toBeLessThan(result.text.indexOf('chapter 2')); expect(result.text).toContain('--- Page 3: Chapter 3 ---');
    expect(result.reason).toBe('no-next'); expect(result.message).toBe('No next-page link found; check completeness.'); expect(counts).toEqual([0, 1, 1, 2, 2, 3]);
  });
  test('single-page reading never follows the discovered next link', async () => {
    const source = fixture(page(1, [2]), page(2)); const result = await collectStoryPages({ url: link(1) }, source.fetch);
    expect(source.called).toEqual([link(1)]); expect(result.reason).toBe('single-page');
  });
  test('explicit page links replace discovery and retain their supplied order', async () => {
    const source = fixture(page(1, [7, 8]), page(2), page(3));
    const result = await collectStoryPages({ url: link(1), linked: true, otherUrls: [link(3), link(2)] }, source.fetch);
    expect(source.called).toEqual([link(1), link(3), link(2)]); expect(result.reason).toBe('provided-pages'); expect(result.message).toContain('Check story completeness');
  });
  test('ambiguous navigation stops without guessing or discarding collected pages', async () => {
    const source = fixture(page(1, [2, 3])); const result = await collectStoryPages({ url: link(1), linked: true }, source.fetch);
    expect(result.pages).toHaveLength(1); expect(source.called).toHaveLength(1); expect(result.reason).toBe('ambiguous');
  });
  test('identical links with different anchors count as one candidate', async () => {
    const first = page(1); first.nextPages = [{ title: 'Next', url: `${link(2)}#top` }, { title: 'Continue', url: `${link(2)}#read` }];
    const source = fixture(first, page(2)); const result = await collectStoryPages({ url: link(1), linked: true }, source.fetch);
    expect(result.pages).toHaveLength(2); expect(source.called).toEqual([link(1), link(2)]);
  });
  test('loops stop before refetching a visited URL, including fragments', async () => {
    const second = page(2); second.nextPages = [{ title: 'Next', url: `${link(1)}#continue` }];
    const source = fixture(page(1, [2]), second); const result = await collectStoryPages({ url: link(1), linked: true }, source.fetch);
    expect(result.reason).toBe('loop'); expect(result.pages).toHaveLength(2); expect(source.called).toHaveLength(2);
  });
  test('duplicate prose is rejected even if capitalization and whitespace differ', async () => {
    const first = page(1, [2]), second = page(2); second.text = first.text.toUpperCase().replaceAll(' ', '\n\n');
    const source = fixture(first, second); const result = await collectStoryPages({ url: link(1), linked: true }, source.fetch);
    expect(result.reason).toBe('duplicate-text'); expect(result.pages).toHaveLength(1); expect(result.text).not.toContain('Page 2');
  });
  test('network failure retains the collected prefix, while initial failure is empty', async () => {
    const source = fixture(page(1, [2])); const result = await collectStoryPages({ url: link(1), linked: true }, source.fetch);
    expect(result.reason).toBe('fetch-error'); expect(result.pages).toHaveLength(1); expect(result.stoppedAt).toBe(link(2)); expect(result.message).toContain('Site unavailable');
    const empty = await collectStoryPages({ url: link(2), linked: true }, source.fetch); expect(empty.pages).toHaveLength(0); expect(empty.text).toBe('');
  });
  test('page caps stop before another request and character caps include boundaries', async () => {
    const source = fixture(page(1, [2]), page(2)); const result = await collectStoryPages({ url: link(1), linked: true, maxPages: 1 }, source.fetch);
    expect(result.reason).toBe('page-limit'); expect(source.called).toEqual([link(1)]);
    const exact = await collectStoryPages({ url: link(1) }, source.fetch);
    const capped = await collectStoryPages({ url: link(1), linked: true, maxCharacters: exact.text.length }, source.fetch);
    expect(capped.reason).toBe('character-limit'); expect(capped.pages).toHaveLength(1); expect(capped.text.length).toBe(exact.text.length);
    const tiny = await collectStoryPages({ url: link(1), maxCharacters: page(1).text.length }, source.fetch); expect(tiny.pages).toHaveLength(0); expect(tiny.reason).toBe('character-limit');
  });
  test('production page and text ceilings cannot be raised by caller options', async () => {
    let count = 0; const capped = await collectStoryPages({ url: link(1), linked: true, maxPages: 1000 }, async url => { count++; const index = Number(url.split('/').at(-1)); return page(index, [index + 1]); });
    expect(capped.pages).toHaveLength(100); expect(count).toBe(100); expect(capped.reason).toBe('page-limit');
    const huge = await collectStoryPages({ url: link(1), maxCharacters: 2_000_000 }, async () => ({ ...page(1), text: 'x'.repeat(500_000) }));
    expect(huge.reason).toBe('character-limit'); expect(huge.text).toBe('');
  });
  test('same-origin checks cover explicit links, discovered links, and returned URLs', async () => {
    const source = fixture(page(1));
    const explicit = await collectStoryPages({ url: link(1), linked: true, otherUrls: ['https://other.example/story'] }, source.fetch); expect(explicit.reason).toBe('invalid-url'); expect(source.called).toEqual([link(1)]);
    const discovered = await collectStoryPages({ url: link(1), linked: true }, async () => ({ ...page(1), nextPages: [{ title: 'Next', url: 'http://stories.example/read/2' }] })); expect(discovered.reason).toBe('invalid-url');
    const redirected = await collectStoryPages({ url: link(1) }, async () => ({ ...page(1), url: 'https://other.example/story' })); expect(redirected.pages).toHaveLength(0); expect(redirected.reason).toBe('invalid-url');
  });
  test('canonical Literotica story aliases stay on one origin before fetching', async () => {
    const calls:string[]=[];const first='https://www.literotica.com/s/neutral-fixture';const second=`${first}?page=2`;
    const result=await collectStoryPages({url:'http://literotica.com/s/neutral-fixture',linked:true},async url=>{calls.push(url);return url===first?{...page(1),url:first,nextPages:[{title:'Next',url:second}]}:{...page(2),url:second};});
    expect(calls).toEqual([first,second]);expect(result.pages).toHaveLength(2);expect(result.reason).toBe('no-next');
    expect(publicPageUrl('https://german.literotica.com/s/story')).toBe('https://german.literotica.com/s/story');
    expect(publicPageUrl('http://literotica.com/other')).toBe('http://literotica.com/other');
  });
  test('private, credentialed, and unsupported URLs never reach the fetcher', async () => {
    for (const url of ['file:///a', 'http://localhost/a', 'http://127.0.0.1/a', 'http://[::1]/a', 'https://user:secret@stories.example/a', 'http://books.internal/a']) {
      let called = false; const result = await collectStoryPages({ url }, async () => { called = true; return page(1); }); expect(called).toBe(false); expect(result.reason).toBe('invalid-url');
    }
    expect(publicPageUrl(`${link(1)}#reading`)).toBe(link(1));
  });
  test('cancellation returns immediately, retains prior pages, and ignores a late reply', async () => {
    const controller = new AbortController(); let resolveLate!: (page: WebStoryPage) => void; let requestedSecond!: () => void;
    const secondRequested = new Promise<void>(resolve => { requestedSecond = resolve; }); let progressCalls = 0;
    const pending = collectStoryPages({ url: link(1), linked: true, signal: controller.signal, onProgress: () => { progressCalls++; } }, async url => {
      if (url === link(1)) return page(1, [2]); requestedSecond(); return new Promise<WebStoryPage>(resolve => { resolveLate = resolve; });
    });
    await secondRequested; controller.abort();
    const result = await Promise.race([pending, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Cancellation waited for the page')), 30))]);
    const before = progressCalls; expect(result.reason).toBe('cancelled'); expect(result.pages).toHaveLength(1);
    resolveLate(page(2)); await new Promise(resolve => setTimeout(resolve, 0)); expect(result.pages).toHaveLength(1); expect(progressCalls).toBe(before);
  });
  test('an already cancelled operation never requests even the first page', async () => {
    const controller = new AbortController(); controller.abort(); const source = fixture(page(1));
    const result = await collectStoryPages({ url: link(1), signal: controller.signal }, source.fetch); expect(result.reason).toBe('cancelled'); expect(source.called).toHaveLength(0);
  });
});
