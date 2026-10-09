import { describe, expect, test } from 'bun:test';
import { storyUrl, extractPage } from '../src/source';

const neutralProse = 'Mara stepped into the old lighthouse. Outside, Captain Iona waited beside the harbor, watching the storm. A letter lay on the desk, sealed in blue wax. ';
function page(navigation = '', url = 'https://example.com/story/chapter-one', head = '') {
  const body = `<html><head><title>The Lighthouse</title>${head}</head><body>${navigation}<article><h1>The Lighthouse</h1>${Array.from({length:5}, () => `<p>${neutralProse.repeat(2)}</p>`).join('')}</article></body></html>`;
  return extractPage({status:200,headers:{'content-type':'text/html'},body},url);
}

describe('web story input', () => {
  test('rejects credentials, non-web schemes, local addresses, and accepts public pages', () => {
    for (const value of ['file:///etc/passwd','https://user:pass@example.com/story','http://127.0.0.1/','http://2130706433/','http://[::1]/','http://story.local/','https://localhost/story']) expect(() => storyUrl(value)).toThrow();
    expect(storyUrl('https://example.com/story#chapter')).toBe('https://example.com/story');
  });
  test('extracts prose without scripts, navigation, or running external resources', () => {
    const paragraph = 'Mara stepped into the old lighthouse. Outside, Captain Iona waited beside the harbor, watching the storm. A letter lay on the desk, sealed in blue wax. ';
    const body = `<html><head><title>A lighthouse story</title></head><body><nav>MENU SHOULD DISAPPEAR</nav><article><h1>The Lighthouse</h1>${Array.from({length:5}, () => `<p>${paragraph.repeat(2)}</p>`).join('')}</article><script>throw new Error('EXECUTED')</script><footer>FOOTER</footer></body></html>`;
    const result = extractPage({status:200,headers:{'Content-Type':'text/html'},body}, 'https://example.com/story');
    expect(result.text).toContain('Mara stepped'); expect(result.text).not.toContain('EXECUTED'); expect(result.text).not.toContain('MENU SHOULD DISAPPEAR'); expect(result.text).toContain('\n');
  });
  test('blocked, empty, oversized, and unsupported sources fail explicitly', () => {
    expect(() => extractPage({status:403,body:'Denied'},'https://example.com')).toThrow('403');
    expect(() => extractPage({status:200,body:''},'https://example.com')).toThrow('empty');
    expect(() => extractPage({status:200,headers:{'content-type':'application/pdf'},body:'%PDF'},'https://example.com')).toThrow('text file');
    expect(() => extractPage({status:200,headers:{'content-type':'text/plain'},body:'x'.repeat(500001)},'https://example.com')).toThrow('500,000');
  });

  test('discovers relative successors before removing navigation from prose', () => {
    const result = page('<header><nav><a href="chapter-two#start">Next chapter</a></nav></header><footer>FOOTER SHOULD DISAPPEAR</footer>');
    expect(result.nextPages).toEqual([{url:'https://example.com/story/chapter-two',title:'Next chapter'}]);
    expect(result.text).toContain('Mara stepped');
    expect(result.text).not.toContain('Next chapter');
    expect(result.text).not.toContain('FOOTER SHOULD DISAPPEAR');
  });

  test('rel next has priority over less certain labels and duplicate links are combined', () => {
    const result = page('<nav><a rel="nofollow next" href="?page=2#top">Next page</a><a href="?page=2">Next page</a></nav><aside><a href="another-work">Next chapter</a></aside>', undefined, '<link rel="next" href="?page=2">');
    expect(result.nextPages).toEqual([{url:'https://example.com/story/chapter-one?page=2',title:'Next page'}]);
  });

  test('distinct plausible successors remain ambiguous, including distinct rel next links', () => {
    expect(page('<nav><a href="one">Next chapter</a><a href="two">Continue the story</a></nav>').nextPages.map(x=>x.url)).toEqual(['https://example.com/story/one','https://example.com/story/two']);
    expect(page('<nav><a rel="next" href="one">First route</a><a rel="next" href="two">Second route</a></nav>').nextPages).toHaveLength(2);
  });

  test('bare next and arrows require a recognized pagination context', () => {
    for (const marker of ['class="pagination"','class="pager"','aria-label="Page navigation"']) {
      for (const label of ['Next','Next »','›','»']) {
        expect(page(`<nav ${marker}><a href="?page=2">${label}</a></nav>`).nextPages).toHaveLength(1);
      }
    }
    expect(page('<nav><a href="next">Next</a></nav><aside><a href="another">»</a></aside>').nextPages).toEqual([]);
  });

  test('excludes previous, table of contents, comments and recommendations', () => {
    const result = page('<nav class="pagination"><a href="previous" rel="prev">Next page</a><a href="contents" rel="next">Table of contents</a><a href="previous-again" title="Previous page">Next page</a></nav><section class="related-stories"><a rel="next" href="related-story">Next chapter</a></section><div id="comments"><a rel="next" href="?page=2">Next page</a></div>');
    expect(result.nextPages).toEqual([]);
  });

  test('rejects external, unsafe, current, disabled and download destinations', () => {
    const hrefs = ['https://elsewhere.example/story','//elsewhere.example/story','http://example.com/story/next','javascript:alert(1)','data:text/html,test','file:///tmp/story','https://user:pass@example.com/next','https://127.0.0.1/next','#chapter','chapter-one#other','/login','/comments/2','/download/story','next.pdf','next?download=1','next?action=login','next?format=epub','/%ZZ'];
    const nav = hrefs.map(href=>`<a rel="next" href="${href}">Next chapter</a>`).join('') + '<a href="safe-next" download>Next chapter</a><a rel="next" href="disabled" aria-disabled="true">Next chapter</a>';
    expect(page(`<nav>${nav}</nav>`).nextPages).toEqual([]);
  });

  test('pages without recognized links and plain text always return an empty successor array', () => {
    expect(page('<a href="chapter-two">Two</a>').nextPages).toEqual([]);
    expect(extractPage({status:200,headers:{'content-type':'text/plain'},body:neutralProse},'https://example.com/story.txt').nextPages).toEqual([]);
  });

  test('normalizes only known English Literotica story aliases', () => {
    expect(storyUrl('http://literotica.com/s/lighthouse?page=2#top')).toBe('https://www.literotica.com/s/lighthouse?page=2');
    expect(storyUrl('http://www.literotica.com/s/lighthouse')).toBe('https://www.literotica.com/s/lighthouse');
    expect(storyUrl('https://german.literotica.com/s/lighthouse')).toBe('https://german.literotica.com/s/lighthouse');
    expect(storyUrl('http://literotica.com:8080/s/lighthouse')).toBe('http://literotica.com:8080/s/lighthouse');
    expect(storyUrl('https://notliterotica.com/s/lighthouse')).toBe('https://notliterotica.com/s/lighthouse');
  });

  // Neutral markup fixture based on the current site's pagination contract as
  // documented by FanFicFare's adapter_literotica.py (2026): nav._pagination_*,
  // a._pagination__item_* / legacy a.l_bJ and ?page=N. No source story is copied.
  test('Literotica numbered pagination chooses only the next existing page', () => {
    const result = page('<nav class="panel _pagination_ab12"><span class="_pagination__item_ab12">1</span><a class="_pagination__item_ab12" href="https://www.literotica.com/s/lighthouse?page=2">2</a><a class="_pagination__item_ab12" href="?page=3">3</a><a class="_pagination__item_ab12" href="?page=17">17</a><a class="_pagination__item_ab12" href="?page=2"><svg aria-hidden="true"><path d="M1 1"/></svg></a></nav>', 'https://literotica.com/s/lighthouse');
    expect(result.url).toBe('https://www.literotica.com/s/lighthouse');
    expect(result.nextPages).toEqual([{url:'https://www.literotica.com/s/lighthouse?page=2',title:'Page 2'}]);
    expect(result.text).not.toContain('17');
  });

  test('Literotica SVG next arrows work on a middle page and stop at the last', () => {
    const result = page('<nav class="panel _pagination_new"><a class="_pagination__item_new" href="?page=1"><svg/></a><a class="_pagination__item_new" href="?page=3"><svg/></a></nav>', 'https://www.literotica.com/s/lighthouse?page=2');
    expect(result.nextPages).toEqual([{url:'https://www.literotica.com/s/lighthouse?page=3',title:'Page 3'}]);
    expect(page('<nav class="panel _pagination_new"><a href="?page=1">1</a><a href="?page=2"><svg/></a><span>3</span></nav>','https://www.literotica.com/s/lighthouse?page=3').nextPages).toEqual([]);
  });

  test('Literotica legacy pagination and language hosts retain the same origin', () => {
    expect(page('<nav class="panel clearfix _pagination_old"><a class="l_bJ" href="?page=2">2</a></nav>','https://german.literotica.com/s/lighthouse').nextPages).toEqual([{url:'https://german.literotica.com/s/lighthouse?page=2',title:'Page 2'}]);
    expect(page('<div class="b-pager"><a class="b-pager-next" href="?page=2"><span></span></a></div>','https://www.literotica.com/s/lighthouse').nextPages).toHaveLength(1);
  });

  test('Literotica numbered fallback cannot jump pages, change stories, origin or query context', () => {
    const hrefs = ['?page=3','?page=2&page=3','?page=0','?page=2&mode=other','/s/other-story?page=2','https://german.literotica.com/s/lighthouse?page=2'];
    expect(page(`<nav class="_pagination_ab">${hrefs.map(href=>`<a href="${href}">2</a>`).join('')}</nav>`,'https://www.literotica.com/s/lighthouse').nextPages).toEqual([]);
    expect(page('<nav class="_pagination_ab"><a href="?page=2">2</a></nav>','https://example.com/s/lighthouse').nextPages).toEqual([]);
    expect(page('<a class="_pagination__item_ab" href="?page=2">2</a>','https://www.literotica.com/s/lighthouse').nextPages).toEqual([]);
    expect(page('<nav class="_pagination_ab"><a href="?page=3">3</a></nav>','https://www.literotica.com/s/lighthouse?page=2&page=1').nextPages).toEqual([]);
  });
});
