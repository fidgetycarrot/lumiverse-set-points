import { expect, test } from 'bun:test';

// The same patterns Lumiverse uses to refuse a backend that calls fetch()
// directly (src/spindle/manager.service.ts, October 2026). The built bundle
// must never match them: web pages go through Lumiverse's CORS proxy.
const blocked = [
  /(?<![.\w$])fetch\s*(?:\?\.\s*)?\(/,
  /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*fetch\b/,
  /(?<![.\w$])fetch\s*\.\s*(?:call|apply|bind)\s*\(/,
  /\b(?:globalThis|global|self)\s*\.\s*fetch\b/,
  /\bBun\.(?:file|write|spawn|spawnSync|serve|connect|listen|fetch)\b/,
  /(?:from\s*["'`](?:node-fetch|undici|cross-fetch|bun)["'`])/,
];

test('the built backend passes Lumiverse’s blocked-capability check', async () => {
  const bundle = await Bun.file(new URL('../dist/backend.js', import.meta.url)).text();
  for (const pattern of blocked) expect({ pattern: String(pattern), found: pattern.exec(bundle)?.[0] ?? null }).toEqual({ pattern: String(pattern), found: null });
});
