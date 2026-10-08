import { describe, expect, test } from 'bun:test';
import { storyUrl, extractPage } from '../src/source';

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
});
