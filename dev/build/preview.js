// src/types.ts
var VERSION = "0.1.7";
var DEMO_STORY = `The Lighthouse Letter

Mara, a cautious cartographer who hides her nerves behind dry humor, arrives at Greyhaven to find her missing brother Elias. Elias repairs the lighthouse and trusts Captain Iona, a blunt sailor who values promises. Mara knows neither why Elias vanished nor who last saw him.

At the harbor, Iona tells Mara that Elias left a sealed letter in the old chart room. Iona is wary of outsiders, but admits she is worried. A storm will reach Greyhaven at midnight. Mara can ask Iona for help or investigate alone.

The chart room contains a letter from Elias: the lighthouse lens was deliberately damaged, and he has gone to the north cove to find a replacement. He asks for a lantern signal if the boat should return. The letter is the first evidence that Elias left willingly.

At the north cove, Elias waits beside a stranded boat. He has the lens, but the tide has blocked the footpath. Iona knows a sea route back. The group must decide how to carry the fragile lens home.

At the lighthouse, the storm arrives. The replacement lens can restore the beacon. Whether Mara repairs it, asks for help, or finds another solution remains her choice.`;

// src/styles.ts
var styles = `
.sp-app{--sp-bg:var(--lumiverse-bg,#181b20);--sp-card:var(--lumiverse-bg-secondary,#20242a);--sp-ink:var(--lumiverse-text,#eeeae2);--sp-muted:var(--lumiverse-text-muted,#a4a6ab);--sp-line:color-mix(in srgb,var(--sp-ink) 14%,transparent);--sp-accent:#e9b968;--sp-accent-ink:#211a10;--sp-radius:12px;color:var(--sp-ink);background:var(--sp-bg);font:14px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100%;padding:26px 24px 36px;box-sizing:border-box;color-scheme:dark;container-type:inline-size;overflow-wrap:anywhere}
.sp-app *, .sp-app *:before,.sp-app *:after{box-sizing:border-box}.sp-app [hidden]{display:none!important}.sp-app h1,.sp-app h2,.sp-app h3,.sp-app p{margin:0}.sp-app h1{font:normal 38px/1.15 Georgia,"Times New Roman",serif;letter-spacing:-1.5px}.sp-app h2{font:normal 25px/1.25 Georgia,"Times New Roman",serif;letter-spacing:-.4px}.sp-app h3{font-size:15px;font-weight:650}.sp-app button,.sp-app input,.sp-app textarea,.sp-app select{font:inherit}.sp-app button{cursor:pointer}.sp-app button:disabled{cursor:not-allowed;opacity:.46}.sp-app button:focus-visible,.sp-app summary:focus-visible,.sp-app input:focus-visible,.sp-app textarea:focus-visible,.sp-app select:focus-visible{outline:2px solid var(--sp-accent);outline-offset:3px}.sp-app input,.sp-app textarea,.sp-app select{width:100%;border:1px solid var(--sp-line);border-radius:8px;background:color-mix(in srgb,var(--sp-bg) 80%,transparent);color:var(--sp-ink);padding:10px 12px;min-width:0}.sp-app textarea{resize:vertical;min-height:90px}.sp-app input::placeholder,.sp-app textarea::placeholder{color:var(--sp-muted);opacity:.7}.sp-app select option{background:var(--sp-card);color:var(--sp-ink)}
.sp-header{display:flex;align-items:center;gap:15px;margin-bottom:28px}.sp-mark{flex:none;width:44px;height:54px;position:relative;border-left:1px solid var(--sp-accent);transform:skewY(-18deg);margin:0 1px 0 12px}.sp-mark:before,.sp-mark:after{content:"";width:13px;height:13px;border:2px solid var(--sp-accent);border-radius:50%;position:absolute;background:var(--sp-bg);left:-7px}.sp-mark:before{top:0}.sp-mark:after{bottom:0;background:var(--sp-accent)}.sp-mark span{position:absolute;left:0;top:26px;width:35px;border-top:1px solid var(--sp-accent)}.sp-eyebrow{font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:var(--sp-accent);margin-bottom:6px!important}.sp-subtitle{font-size:12px;color:var(--sp-muted);margin-top:6px!important}.sp-tabs{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--sp-line);gap:8px;margin-bottom:24px}.sp-tab{background:none;border:0;color:var(--sp-muted);padding:11px 4px 14px;border-bottom:2px solid transparent;margin-bottom:-1px;text-align:left;font-size:13px!important}.sp-tab[aria-selected=true]{border-color:var(--sp-accent);color:var(--sp-ink)}.sp-tab small{color:var(--sp-accent);margin-right:7px;font-size:10px;letter-spacing:1px}.sp-intro{display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:20px}.sp-muted{color:var(--sp-muted)}.sp-small{font-size:12px}.sp-intro p{margin-top:7px}.sp-panel{display:flex;flex-direction:column;gap:18px}.sp-card{border:1px solid var(--sp-line);border-radius:var(--sp-radius);padding:18px;background:var(--sp-card)}.sp-collection{border-top:1px solid var(--sp-line);padding-top:15px}.sp-page-list{margin:0;padding-left:20px;max-height:210px;overflow:auto}.sp-page-list li{padding:3px 0 10px}.sp-page-list li>span,.sp-page-list li>a{display:block}.sp-page-list a{color:var(--sp-muted);text-decoration:underline;text-underline-offset:2px;word-break:break-all}.sp-card>h3{margin-bottom:12px}.sp-stack{display:flex;flex-direction:column;gap:14px}.sp-field{display:flex;flex-direction:column;gap:6px}.sp-label{font-size:12px;font-weight:650;letter-spacing:.2px}.sp-hint{font-size:11px;line-height:1.5;color:var(--sp-muted)}.sp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.sp-row.sp-spread{justify-content:space-between}.sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sp-button{border:1px solid var(--sp-line);border-radius:8px;background:transparent;color:var(--sp-ink);padding:9px 13px;font-weight:600;font-size:12px!important;line-height:1.4;display:inline-flex;justify-content:center;align-items:center;gap:8px;white-space:normal}.sp-button:hover:not(:disabled){background:color-mix(in srgb,var(--sp-ink) 7%,transparent)}.sp-button.sp-primary{background:var(--sp-accent);color:var(--sp-accent-ink);border-color:var(--sp-accent)}.sp-button.sp-primary:hover:not(:disabled){filter:brightness(1.07)}.sp-button.sp-text{border:0;color:var(--sp-accent);padding:3px 0;font-weight:500}.sp-button.sp-wide{width:100%;padding:13px}.sp-source{min-height:245px!important;line-height:1.65!important;font:14px/1.7 Georgia,"Times New Roman",serif!important}.sp-separator{height:1px;background:var(--sp-line);margin:2px 0}.sp-details{border:1px solid var(--sp-line);border-radius:10px;background:var(--sp-card);padding:0 15px}.sp-details>summary{cursor:pointer;font-weight:600;font-size:12px;padding:14px 0;list-style-position:inside}.sp-details[open]>summary{border-bottom:1px solid var(--sp-line);margin-bottom:15px}.sp-details>.sp-stack{padding-bottom:16px}.sp-details .sp-hint{font-weight:400}.sp-status{font-size:12px;line-height:1.5;padding:11px 13px;background:color-mix(in srgb,var(--sp-accent) 9%,var(--sp-bg));border:1px solid color-mix(in srgb,var(--sp-accent) 24%,transparent);border-radius:8px;margin-bottom:17px}.sp-status[data-kind=error]{border-color:#c6786c;color:#efa99e;background:color-mix(in srgb,#c6786c 8%,var(--sp-bg))}.sp-status:empty{display:none}.sp-progress{display:flex;flex-direction:column;gap:9px;border:1px solid var(--sp-line);padding:16px;border-radius:10px}.sp-progress progress{width:100%;height:6px;accent-color:var(--sp-accent);border:0}.sp-empty{padding:32px 22px;border:1px dashed var(--sp-line);border-radius:12px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}.sp-empty p{max-width:320px}.sp-tag{display:inline-block;padding:4px 8px;border-radius:5px;background:color-mix(in srgb,var(--sp-accent) 10%,transparent);color:var(--sp-accent);font-size:10px;font-weight:650;letter-spacing:1px;text-transform:uppercase}.sp-counts{display:flex;gap:20px;border-top:1px solid var(--sp-line);border-bottom:1px solid var(--sp-line);padding:13px 0;margin-top:17px}.sp-counts strong{display:block;font:normal 24px Georgia,serif;color:var(--sp-ink)}.sp-counts span{font-size:11px;color:var(--sp-muted)}.sp-section-label{font-size:10px;text-transform:uppercase;letter-spacing:1.6px;color:var(--sp-muted);font-weight:700;padding-top:4px}.sp-review-group{display:flex;flex-direction:column;gap:9px}.sp-scene-num{font-variant-numeric:tabular-nums;color:var(--sp-accent);font-size:11px;margin-right:8px}.sp-notice{border-left:2px solid var(--sp-accent);padding:3px 0 3px 13px;font-size:12px;color:var(--sp-muted)}.sp-footnote{font-size:11px;color:var(--sp-muted);line-height:1.6}.sp-footer{margin-top:30px;padding-top:16px;border-top:1px solid var(--sp-line);display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--sp-muted);font-size:10px;letter-spacing:.4px}.sp-footer button{font-size:10px!important}.sp-preview{white-space:pre-wrap;font:15px/1.8 Georgia,"Times New Roman",serif;max-height:280px;overflow:auto;padding-right:4px}.sp-stage-title{font:normal 25px/1.3 Georgia,serif;margin-top:9px!important;margin-bottom:12px!important}.sp-switch{display:flex;align-items:center;justify-content:space-between;gap:20px}.sp-switch input{width:36px;height:20px;accent-color:var(--sp-accent);flex:none}.sp-play-track{display:flex;gap:5px;margin:17px 0 7px}.sp-play-track span{height:3px;flex:1;border-radius:2px;background:var(--sp-line)}.sp-play-track span[data-done=true]{background:var(--sp-accent)}.sp-saved{border:1px solid color-mix(in srgb,var(--sp-accent) 40%,transparent);border-radius:10px;padding:15px;background:color-mix(in srgb,var(--sp-accent) 5%,transparent)}.sp-saved code{font-size:10px;word-break:break-all}.sp-inline-code{font:11px/1.6 ui-monospace,monospace;white-space:pre-wrap}.sp-app .sp-no-margin{margin:0}
@media(prefers-color-scheme:light){.sp-app{--sp-bg:var(--lumiverse-bg,#faf8f3);--sp-card:var(--lumiverse-bg-secondary,#fffdf8);--sp-ink:var(--lumiverse-text,#28251f);--sp-muted:var(--lumiverse-text-muted,#746e62);--sp-accent:#996219;--sp-accent-ink:#fff9ed;color-scheme:light}.sp-status[data-kind=error]{color:#a43f33}}
@container(max-width:380px){.sp-grid{grid-template-columns:1fr}.sp-intro{flex-wrap:wrap}.sp-counts{gap:14px}.sp-header{gap:10px}.sp-app h1{font-size:33px}.sp-tab small{margin-right:4px}.sp-button{padding:9px 10px}}
`;

// src/appearance-review.ts
var appearanceWords = /\b(?:hair|haired|blond(?:e)?|brunette|redhead|bald|eyes?|freckles?|complexion|skin|scar(?:s|red)?|tattoo(?:s|ed)?|beard|moustache|mustache|height|physique|clothes|clothing|outfit|dress|coat|jacket|shirt|trousers|pants|skirt|boots|uniform|cloak|robe|glasses|horns?|fur|scales|wings?)\b/i;
function excerpts(text) {
  const expression = new RegExp(appearanceWords.source, "gi"), result = [];
  let coveredUntil = 0, match;
  while ((match = expression.exec(text)) && result.length < 2) {
    if (match.index < coveredUntil)
      continue;
    let start = Math.max(0, match.index - 70), end = Math.min(text.length, match.index + match[0].length + 110);
    if (start) {
      const space = text.indexOf(" ", start);
      if (space >= start && space < match.index)
        start = space + 1;
    }
    if (end < text.length) {
      const space = text.lastIndexOf(" ", end);
      if (space > match.index + match[0].length)
        end = space;
    }
    result.push(`${start ? "…" : ""}${text.slice(start, end).trim().replace(/\s+/g, " ")}${end < text.length ? "…" : ""}`);
    coveredUntil = end;
  }
  return result;
}
function appearanceMentions(draft) {
  const fields = [
    { location: "Story title", text: draft.title, fieldKey: "title" },
    { location: "Premise", text: draft.premise, fieldKey: "premise" },
    { location: "Player role", text: draft.playerRole, fieldKey: "playerRole" },
    { location: "Starting point", text: draft.startingPoint, fieldKey: "startingPoint" },
    { location: "Narrator direction", text: draft.narratorInstructions, fieldKey: "narratorInstructions" }
  ];
  for (const person of draft.cast) {
    fields.push({ location: `${person.name} · name`, text: person.name, fieldKey: `cast:${person.id}:name` });
    fields.push({ location: `${person.name} · aliases`, text: person.aliases.join(", "), fieldKey: `cast:${person.id}:aliases` });
    for (const [label, field] of [["Personality", "personality"], ["Voice & manner", "voice"], ["Relationships at the start", "relationships"], ["Knowledge at the start", "knowledge"]])
      fields.push({ location: `${person.name} · ${label}`, text: person[field], fieldKey: `cast:${person.id}:${field}` });
  }
  for (const entry of draft.lore)
    fields.push({ location: `Lore · ${entry.name}`, text: entry.content, fieldKey: `lore:${entry.id}:content` });
  for (const [index, scene] of draft.scenes.entries()) {
    fields.push({ location: `Scene ${index + 1} · title`, text: scene.title, fieldKey: `scene:${scene.id}:title` });
    fields.push({ location: `Scene ${index + 1} · ${scene.title} · opening`, text: scene.greeting, fieldKey: `scene:${scene.id}:greeting` });
    fields.push({ location: `Scene ${index + 1} · ${scene.title} · private direction`, text: scene.direction, fieldKey: `scene:${scene.id}:direction` });
    scene.assumptions.forEach((text, i) => fields.push({ location: `Scene ${index + 1} · ${scene.title} · assumption ${i + 1}`, text, fieldKey: `scene:${scene.id}:assumption:${i}` }));
  }
  return fields.flatMap((field) => excerpts(field.text).map((text) => ({ ...field, text })));
}

// src/importer.ts
var IMPORT_LIMITS = Object.freeze({ sourceCharacters: 500000, chunks: 48, scenes: 32, defaultChunkSize: 12000, ledgerCharacters: 24000, draftCharacters: 192000, requestCharacters: 256000 });

// src/visuals.ts
var VISUAL_LIMITS = Object.freeze({ profiles: 64, tags: 32, outfitTags: 12, tagCharacters: 72, tagWords: 7, packCharacters: 4000000 });
var UNSPECIFIED_APPEARANCE = "Not specified in the source.";
function visualDraftSignature(draft) {
  const clean = (value) => value.trim();
  const url = draft.source.url?.trim();
  return JSON.stringify({ id: clean(draft.id), title: clean(draft.title), premise: clean(draft.premise), playerRole: clean(draft.playerRole), startingPoint: clean(draft.startingPoint), source: { title: clean(draft.source.title), url: url || undefined, characters: draft.source.characters, chunks: draft.source.chunks }, cast: draft.cast.map((person) => ({ id: clean(person.id), name: clean(person.name), aliases: person.aliases.map(clean), personality: clean(person.personality), voice: clean(person.voice), relationships: clean(person.relationships), knowledge: clean(person.knowledge), sourceRefs: [...new Set(person.sourceRefs.map(clean))] })) });
}
function visualTagPrompt(profile, includeSuggestions = false) {
  return [...new Set([profile.countTag, ...profile.appearanceTags, ...profile.outfitTags, ...includeSuggestions ? profile.suggestedTags : []].map((value) => value.trim()).filter(Boolean))].join(", ");
}
function visualCaption(profile, includeSuggestions = false) {
  return [profile.subject, profile.description, profile.startingOutfit, ...includeSuggestions ? [profile.suggestedDetails] : []].map((value) => value.trim()).filter((value) => value && value !== UNSPECIFIED_APPEARANCE).join(" ");
}

// src/web-import.ts
var WEB_IMPORT_LIMITS = { pages: 100, characters: 500000 };
function publicPageUrl(value, origin) {
  if (typeof value !== "string" || value.length > 4096)
    throw new Error("Enter a complete public HTTP or HTTPS story link.");
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a complete public HTTP or HTTPS story link.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Use public HTTP or HTTPS links without embedded credentials.");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || /\.(local|localhost|internal|lan|home)$/.test(host) || host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(host))
    throw new Error("Page collection accepts public website names. Paste text for local or private sources.");
  if (["literotica.com", "www.literotica.com"].includes(host) && !url.port && url.pathname.startsWith("/s/")) {
    url.protocol = "https:";
    url.hostname = "www.literotica.com";
  }
  if (origin && url.origin !== origin)
    throw new Error("All collected pages must use the same website, protocol, and port as the first link.");
  url.hash = "";
  return url.href;
}
function cancelled() {
  const error = new Error("Page loading cancelled.");
  error.name = "AbortError";
  return error;
}
async function withAbort(signal, operation) {
  if (signal.aborted)
    throw cancelled();
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted)
        throw cancelled();
      return operation();
    }).then((value) => {
      if (!signal.aborted)
        resolve(value);
    }, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
function bounded(value, ceiling) {
  return value === undefined || !Number.isFinite(value) ? ceiling : Math.min(ceiling, Math.max(1, Math.floor(value)));
}
function copyPage(page) {
  return { title: page.title, text: page.text, url: page.url, nextPages: page.nextPages.map((link) => ({ title: link.title, url: link.url })) };
}
async function collectStoryPages(options, fetchPage) {
  const pages = [];
  let text = "";
  const signal = options.signal ?? new AbortController().signal;
  const seenUrls = new Set;
  const seenText = new Set;
  const maxPages = bounded(options.maxPages, WEB_IMPORT_LIMITS.pages);
  const maxCharacters = bounded(options.maxCharacters, WEB_IMPORT_LIMITS.characters);
  const explicit = options.linked && Boolean(options.otherUrls?.length);
  const supplied = explicit ? [...options.otherUrls] : [];
  let origin;
  let nextUrl;
  const finish = (reason, message, stoppedAt) => ({ pages: pages.map(copyPage), text, reason, message, ...stoppedAt ? { stoppedAt } : {} });
  const progress = (loadingUrl) => {
    if (!signal.aborted)
      options.onProgress?.({ pages: pages.map(copyPage), characters: text.length, loadingUrl });
  };
  if (signal.aborted)
    return finish("cancelled", "Loading cancelled. No pages were added.");
  try {
    nextUrl = publicPageUrl(options.url);
    origin = new URL(nextUrl).origin;
  } catch (error) {
    return finish("invalid-url", error instanceof Error ? error.message : "The first link could not be read.");
  }
  while (true) {
    if (signal.aborted)
      return finish("cancelled", pages.length ? "Loading cancelled. Collected pages are available below." : "Loading cancelled. No pages were added.");
    try {
      nextUrl = publicPageUrl(nextUrl, origin);
    } catch (error) {
      return finish("invalid-url", error instanceof Error ? error.message : "The next link could not be read.");
    }
    if (seenUrls.has(nextUrl))
      return finish("loop", "A page link repeats an earlier page. Stopped before reading it again.", nextUrl);
    if (pages.length >= maxPages)
      return finish("page-limit", `Reached the ${maxPages}-page limit. The remaining pages were not loaded.`, nextUrl);
    progress(nextUrl);
    let page;
    try {
      const fetched = await withAbort(signal, () => fetchPage(nextUrl, signal));
      if (signal.aborted)
        return finish("cancelled", pages.length ? "Loading cancelled. Collected pages are available below." : "Loading cancelled. No pages were added.");
      if (!fetched || typeof fetched.title !== "string" || typeof fetched.text !== "string" || !fetched.text.trim() || !Array.isArray(fetched.nextPages))
        throw new Error("The page returned no readable story text.");
      let resolved;
      try {
        resolved = publicPageUrl(fetched.url, origin);
      } catch {
        return finish("invalid-url", "The returned page is outside the original website or is not a public link. The page was not added.", nextUrl);
      }
      if (seenUrls.has(resolved))
        return finish("loop", "The page resolved to an earlier page. Stopped without adding it again.", resolved);
      page = { title: fetched.title.trim() || `Page ${pages.length + 1}`, text: fetched.text.trim(), url: resolved, nextPages: fetched.nextPages.filter((link) => link && typeof link.url === "string").map((link) => ({ title: typeof link.title === "string" ? link.title : "", url: link.url })) };
    } catch (error) {
      if (signal.aborted)
        return finish("cancelled", pages.length ? "Loading cancelled. Collected pages are available below." : "Loading cancelled. No pages were added.");
      const detail = error instanceof Error ? error.message : "The website did not return a readable page.";
      return finish("fetch-error", `Could not read ${pages.length ? "the next" : "the first"} page. ${detail}`, nextUrl);
    }
    const fingerprint = page.text.replace(/\s+/g, " ").toLowerCase();
    if (seenText.has(fingerprint))
      return finish("duplicate-text", "This page repeats story text already collected. Stopped without adding the duplicate.", page.url);
    const separator = `${pages.length ? `

` : ""}--- Page ${pages.length + 1}: ${page.title.replace(/\s+/g, " ").slice(0, 300)} ---
${page.url}

`;
    if (text.length + separator.length + page.text.length > maxCharacters)
      return finish("character-limit", `The next page would exceed the ${maxCharacters.toLocaleString("en-US")}-character limit. That page was not added.`, page.url);
    seenUrls.add(nextUrl);
    seenUrls.add(page.url);
    seenText.add(fingerprint);
    pages.push(page);
    text += separator + page.text;
    progress(null);
    if (signal.aborted)
      return finish("cancelled", pages.length ? "Loading cancelled. Collected pages are available below." : "Loading cancelled. No pages were added.");
    if (!options.linked)
      return finish("single-page", "One page loaded. Check whether the story continues on another page.");
    if (explicit) {
      const suppliedUrl = supplied.shift();
      if (!suppliedUrl)
        return finish("provided-pages", "Reached the end of your supplied page links. Check story completeness.");
      nextUrl = suppliedUrl;
      continue;
    }
    const candidates = new Map;
    for (const link of page.nextPages) {
      try {
        const normalized = publicPageUrl(link.url, origin);
        candidates.set(normalized, normalized);
      } catch {
        return finish("invalid-url", "A next-page link is outside the original website or is not a public link. Check the page links before continuing.");
      }
    }
    if (candidates.size === 0)
      return finish("no-next", "No next-page link found; check completeness.");
    if (candidates.size > 1)
      return finish("ambiguous", "More than one next-page link was found. Supply every page after the first in reading order, including pages already collected, then read again.");
    nextUrl = candidates.values().next().value;
  }
}

// src/frontend.ts
var MAX_SOURCE = 500000;
var MAX_DRAFT = 192000;
var MAX_BACKUP = MAX_DRAFT * 2;
var ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="M6 8v6a5 5 0 0 0 5 5h4M9 5h9"/></svg>';
function createRpc(ctx, onChanged, timeoutMs = 45000) {
  let sequence = 0;
  const instance = Math.random().toString(36).slice(2);
  let disposed = false;
  const pending = new Map;
  const off = ctx.onBackendMessage((payload) => {
    if (!payload || typeof payload !== "object")
      return;
    const message = payload;
    if (message.type === "set-points:changed") {
      onChanged();
      return;
    }
    if (message.type !== "set-points:response" || typeof message.id !== "string")
      return;
    const request = pending.get(message.id);
    if (!request)
      return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error)
      request.reject(new Error(message.error));
    else
      request.resolve(message.result);
  });
  return {
    request(action, input, requestTimeoutMs = timeoutMs) {
      if (disposed)
        return Promise.reject(new Error("Set Points has closed. Reopen the extension and try again."));
      const id = `sp-${instance}-${Date.now()}-${++sequence}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Lumiverse did not respond in time. Your edits are still here. Refresh the connection before trying again."));
        }, requestTimeoutMs);
        pending.set(id, { resolve: (value) => resolve(value), reject, timer });
        try {
          ctx.sendToBackend({ type: "set-points:request", id, action, input });
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    destroy() {
      disposed = true;
      off();
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error("Set Points closed before the request finished."));
      }
      pending.clear();
    }
  };
}
function node(tag, className = "", text) {
  const result = document.createElement(tag);
  result.className = className;
  if (text !== undefined)
    result.textContent = text;
  return result;
}
function option(label, value) {
  const result = node("option", "", label);
  result.value = value;
  return result;
}
function paragraph(text, className = "sp-muted sp-small") {
  return node("p", className, text);
}
function group(...children) {
  const result = node("div", "sp-stack");
  result.append(...children);
  return result;
}
function row(...children) {
  const result = node("div", "sp-row");
  result.append(...children);
  return result;
}
function details(title) {
  const result = node("details", "sp-details");
  const summary = node("summary", "", title);
  const body = group();
  result.append(summary, body);
  return { root: result, body, summary };
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function setup(ctx) {
  let destroyed = false;
  let selected = "import";
  let snapshot = null;
  let draft = null;
  let draftDirty = false;
  let draftVersion = "";
  let draftRevision = 0;
  let openingDraft = false;
  let pendingReplacement = null;
  const approvedControls = new Map;
  let loadingPages = false;
  let adaptationStarting = false;
  let connectionChecking = false;
  let visualsStarting = false;
  let webAbort = null;
  let stagedPages = null;
  let appliedSourceUrl;
  let resumeSettingsJobId = null;
  let resumeSettingsDirty = false;
  let refreshInFlight = null;
  let refreshAgain = false;
  let polling;
  let panelNonce = 0;
  const teardown = [];
  const tab = ctx.ui.registerDrawerTab({ id: "set-points", title: "Set Points", shortName: "Set Points", description: "Adapt a story. Choose your role. Set the next scene.", keywords: ["story", "import", "narrator", "scenes"], iconSvg: ICON });
  const app = node("div", "sp-app");
  tab.root.append(app);
  teardown.push(ctx.dom.addStyle(styles));
  const header = node("header", "sp-header");
  const mark = node("div", "sp-mark");
  mark.setAttribute("aria-hidden", "true");
  mark.append(node("span"));
  const heading = node("div");
  heading.append(paragraph("A story. Your choices.", "sp-eyebrow"), node("h1", "", "Set Points"), paragraph("Turn a story into somewhere you can go.", "sp-subtitle"));
  header.append(mark, heading);
  const tabs = node("div", "sp-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Story workspace");
  const newDraftNotice = node("div", "sp-status sp-stack");
  newDraftNotice.hidden = true;
  const status = node("div", "sp-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const panels = { import: node("section", "sp-panel"), review: node("section", "sp-panel"), play: node("section", "sp-panel") };
  const nav = new Map;
  const suffix = Math.random().toString(36).slice(2, 8);
  for (const [index, key] of ["import", "review", "play"].entries()) {
    const button = node("button", "sp-tab");
    button.type = "button";
    button.id = `sp-${suffix}-tab-${key}`;
    button.append(node("small", "", `0${index + 1}`), document.createTextNode(key === "import" ? "Import" : key === "review" ? "Review" : "Play"));
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `sp-${suffix}-panel-${key}`);
    button.addEventListener("click", () => selectTab(key));
    button.addEventListener("keydown", (event) => {
      const order = ["import", "review", "play"];
      let next = index;
      if (event.key === "ArrowRight")
        next = (index + 1) % 3;
      else if (event.key === "ArrowLeft")
        next = (index + 2) % 3;
      else if (event.key === "Home")
        next = 0;
      else if (event.key === "End")
        next = 2;
      else
        return;
      event.preventDefault();
      selectTab(order[next]);
      nav.get(order[next])?.focus();
    });
    tabs.append(button);
    nav.set(key, button);
    panels[key].id = `sp-${suffix}-panel-${key}`;
    panels[key].setAttribute("role", "tabpanel");
    panels[key].setAttribute("aria-labelledby", button.id);
  }
  const footer = node("footer", "sp-footer");
  footer.append(node("span", "", `SET POINTS / ${VERSION}`));
  app.append(header, tabs, status, newDraftNotice, panels.import, panels.review, panels.play, footer);
  const rpc = createRpc(ctx, () => {
    refresh();
  });
  function notify(message, kind = "info") {
    if (destroyed)
      return;
    status.textContent = message;
    status.dataset.kind = kind;
  }
  function button(label, action, primary = false) {
    const result = node("button", `sp-button${primary ? " sp-primary" : ""}`, label);
    result.type = "button";
    result.addEventListener("click", () => {
      run(result, action);
    });
    return result;
  }
  async function run(control, action) {
    if (control)
      control.disabled = true;
    try {
      await action();
    } catch (error) {
      notify(errorText(error), "error");
    } finally {
      if (control && !destroyed) {
        control.disabled = false;
        syncImportControls();
      }
    }
  }
  function selectTab(key) {
    selected = key;
    for (const name of ["import", "review", "play"]) {
      panels[name].hidden = name !== key;
      const item = nav.get(name);
      item.setAttribute("aria-selected", String(name === key));
      item.tabIndex = name === key ? 0 : -1;
    }
    if (key === "play")
      refresh();
  }
  let fieldIndex = 0;
  function field(label, value, change, opts = {}) {
    const wrap = node("div", "sp-field");
    const id = `sp-${suffix}-field-${++fieldIndex}`;
    const caption = node("label", "sp-label", label);
    caption.htmlFor = id;
    const input = opts.area ? node("textarea") : node("input");
    input.id = id;
    input.value = value;
    if (input instanceof HTMLInputElement) {
      input.type = opts.type ?? "text";
      if (opts.min !== undefined)
        input.min = String(opts.min);
      if (opts.max !== undefined)
        input.max = String(opts.max);
    }
    if (input instanceof HTMLTextAreaElement && opts.rows)
      input.rows = opts.rows;
    if (opts.placeholder)
      input.placeholder = opts.placeholder;
    if (change)
      input.addEventListener("input", () => change(input.value));
    wrap.append(caption, input);
    if (opts.hint) {
      const help = paragraph(opts.hint, "sp-hint");
      help.id = `${id}-hint`;
      input.setAttribute("aria-describedby", help.id);
      wrap.append(help);
    }
    return { wrap, input };
  }
  function selectField(label, choices, value, onChange) {
    const wrap = node("div", "sp-field"), caption = node("label", "sp-label", label), input = node("select");
    input.id = `sp-${suffix}-field-${++fieldIndex}`;
    caption.htmlFor = input.id;
    for (const [key, text] of choices)
      input.append(option(text, key));
    input.value = value;
    if (onChange) {
      input.addEventListener("change", onChange);
      input.addEventListener("input", onChange);
    }
    wrap.append(caption, input);
    return { wrap, input };
  }
  const responseAllowances = [["8000", "8,000 tokens"], ["16000", "16,000 tokens · default"], ["32000", "32,000 tokens"], ["64000", "64,000 tokens"]];
  const reasoningModes = [["inherit", "Use connection settings"], ["off", "Off"], ["low", "Low"]];
  const responseSettingsHint = "A larger response allowance may cost more or be rejected by your provider. Reasoning overrides also depend on provider support.";
  function readResponseSettings(allowance, reasoning) {
    const maxOutputTokens = Number(allowance.value), reasoningMode = reasoning.value;
    if (![8000, 16000, 32000, 64000].includes(maxOutputTokens))
      throw new Error("Choose one of the available response allowances.");
    if (!["inherit", "off", "low"].includes(reasoningMode))
      throw new Error("Choose one of the available reasoning settings.");
    return { maxOutputTokens, reasoningMode };
  }
  function intro(title, copy) {
    const value = node("div", "sp-intro");
    const text = node("div");
    text.append(node("h2", "", title), paragraph(copy));
    value.append(text);
    return value;
  }
  const backupPanel = node("section", "sp-card sp-stack");
  backupPanel.hidden = true;
  backupPanel.setAttribute("aria-label", "JSON backup");
  const backupName = field("Backup filename", "");
  backupName.input.readOnly = true;
  const backupText = field("JSON backup", "", undefined, { area: true, rows: 12 });
  backupText.input.readOnly = true;
  const downloadUrls = new Map;
  function requestBackupDownload() {
    const url = URL.createObjectURL(new Blob([backupText.input.value], { type: "application/json" }));
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      downloadUrls.delete(url);
    }, 30000);
    downloadUrls.set(url, timer);
    const anchor = node("a");
    anchor.href = url;
    anchor.download = backupName.input.value;
    app.append(anchor);
    try {
      anchor.click();
      notify("Download requested. If no file appears, copy the visible backup and save it using the filename shown.");
    } finally {
      anchor.remove();
    }
  }
  backupPanel.append(node("h3", "", "Your JSON backup"), paragraph("The complete backup is visible below even if your browser blocks downloading. Copy backup, paste it into a plain-text editor, and save it using the shown .json filename.", "sp-hint"), backupName.wrap, backupText.wrap, row(button("Download JSON", () => requestBackupDownload()), button("Copy backup", () => copyVisualText(backupText.input.value, backupText.input, "Backup")), button("Close backup", () => {
    backupPanel.hidden = true;
  })));
  app.insertBefore(backupPanel, panels.import);
  teardown.push(() => {
    for (const [url, timer] of downloadUrls) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    downloadUrls.clear();
  });
  function download(name, value) {
    backupName.input.value = name;
    backupText.input.value = JSON.stringify(value, null, 2);
    backupPanel.hidden = false;
    backupText.input.focus();
    requestBackupDownload();
  }
  newDraftNotice.append(paragraph("A replacement draft is ready. Loading it replaces your unsaved review edits.", "sp-small"), button("Load new draft", () => {
    const replacement = pendingReplacement ?? snapshot?.draft;
    if (!replacement)
      return;
    draft = clone(replacement);
    pendingReplacement = null;
    draftDirty = false;
    draftRevision++;
    draftVersion = JSON.stringify(draft);
    newDraftNotice.hidden = true;
    renderReview();
    selectTab("review");
    notify("New adaptation loaded.");
  }));
  footer.append(button("Download diagnostics", async () => download("set-points-diagnostics.json", await rpc.request("diagnostics"))));
  panels.import.append(intro("Begin with a story", "Bring the cast and the premise. Leave room for yourself."));
  const sourceCard = node("div", "sp-card sp-stack");
  const source = field("Story text", "", () => updateSourceCount(), { area: true, placeholder: "Paste a complete story or a chapter here…" });
  source.input.classList.add("sp-source");
  source.input.maxLength = MAX_SOURCE;
  const count = paragraph("0 characters", "sp-hint");
  const fileInput = node("input");
  fileInput.type = "file";
  fileInput.accept = ".txt,.md,text/plain,text/markdown";
  fileInput.hidden = true;
  fileInput.addEventListener("change", () => void run(null, async () => {
    const file = fileInput.files?.[0];
    if (!file)
      return;
    if (!/\.(txt|md)$/i.test(file.name))
      throw new Error("Choose a .txt or .md file. You can paste text from other formats.");
    if (file.size > MAX_SOURCE * 4)
      throw new Error("This file is too large. Import up to 500,000 characters at a time.");
    const text = await file.text();
    if (text.length > MAX_SOURCE)
      throw new Error("This story is over 500,000 characters. Try a smaller section.");
    appliedSourceUrl = undefined;
    source.input.value = text;
    title.input.value = file.name.replace(/\.(txt|md)$/i, "");
    url.input.value = "";
    updateSourceCount();
    fileInput.value = "";
    notify("Text loaded. Review it below before adapting.");
  }));
  const sourceTools = row(button("Open text file", () => fileInput.click()), button("Try a sample", () => {
    appliedSourceUrl = undefined;
    source.input.value = DEMO_STORY;
    title.input.value = "The Lighthouse Letter";
    role.input.value = "Mara, the cartographer";
    start.input.value = "Mara arrives at Greyhaven harbor";
    url.input.value = "";
    sceneCount.input.value = "4";
    updateSourceCount();
    notify("Sample loaded. Choose an adaptation connection to try it.");
  }));
  sourceTools.classList.add("sp-spread");
  const sourceBottom = row(count, paragraph("Up to 500,000 characters", "sp-hint"));
  sourceBottom.classList.add("sp-spread");
  const title = field("Story title", "", undefined, { placeholder: "Give your adaptation a title" });
  const url = field("Story link", "", undefined, { type: "url", placeholder: "https://…" });
  const linkSection = details("Import from a link");
  const otherUrls = field("Other page links", "", undefined, { area: true, rows: 3, placeholder: "One page link per line, in reading order", hint: "Optional. Replaces automatic next-page discovery. Reading again starts at the first link: include every page after it in order, even pages already collected. All links must stay on the same website." });
  otherUrls.input.maxLength = 409600;
  const collectionBox = node("div", "sp-collection sp-stack");
  collectionBox.hidden = true;
  const collectionCount = paragraph("", "sp-label");
  collectionCount.setAttribute("role", "status");
  collectionCount.setAttribute("aria-live", "polite");
  const collectionMessage = paragraph("", "sp-hint");
  const collectedList = node("ol", "sp-page-list");
  const collectedPreview = details("Preview collected text");
  const collectedText = paragraph("", "sp-preview");
  collectedPreview.body.append(collectedText);
  const cancelLoading = button("Cancel loading", () => {
    webAbort?.abort();
  });
  cancelLoading.hidden = true;
  const useCollected = button("Use collected text", () => {
    if (loadingPages || adaptationStarting || connectionChecking || visualsBusy() || snapshot?.job?.status === "running")
      throw new Error("Wait for the current operation to finish before replacing the story text.");
    if (!stagedPages?.pages.length)
      throw new Error("No pages have been collected yet.");
    appliedSourceUrl = stagedPages.pages[0].url;
    source.input.value = stagedPages.text;
    title.input.value = stagedPages.pages[0].title;
    url.input.value = stagedPages.pages[0].url;
    updateSourceCount();
    notify("Collected pages copied into story text. Check the text and completeness before creating an adaptation.");
  }, true);
  useCollected.hidden = true;
  const applyHint = paragraph("Using the collection replaces the story text and title above. Check that all intended pages are present before adapting.", "sp-hint");
  applyHint.hidden = true;
  collectionBox.append(collectionCount, collectionMessage, collectedList, cancelLoading, collectedPreview.root, useCollected, applyHint);
  const fetchButton = button("Read page", () => readPages(false));
  const fetchLinkedButton = button("Read linked pages", () => readPages(true));
  function showCollection(progress, result) {
    collectionBox.hidden = false;
    collectionCount.textContent = `${progress.pages.length} page${progress.pages.length === 1 ? "" : "s"} collected · ${progress.characters.toLocaleString()} characters`;
    collectionMessage.textContent = (result ? `${result.message}${result.stoppedAt ? ` Stopped at: ${result.stoppedAt}` : ""}` : "") || (progress.loadingUrl ? `Reading page ${progress.pages.length + 1}: ${progress.loadingUrl}` : "Preparing the next page…");
    collectedList.replaceChildren();
    for (const page of progress.pages) {
      const item = node("li");
      const label = node("span", "sp-small", page.title);
      const link = node("a", "sp-hint", page.url);
      link.href = page.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(label, link);
      collectedList.append(item);
    }
    cancelLoading.hidden = !loadingPages;
    collectedPreview.root.hidden = !result?.pages.length;
    useCollected.hidden = !result?.pages.length;
    applyHint.hidden = !result?.pages.length;
    if (result)
      collectedText.textContent = result.text;
    syncImportControls();
  }
  async function readPages(linked) {
    if (loadingPages || adaptationStarting || connectionChecking || visualsBusy() || snapshot?.job?.status === "running")
      throw new Error("Wait for the current page loading, connection check, or adaptation to finish.");
    const controller = new AbortController;
    webAbort = controller;
    loadingPages = true;
    stagedPages = null;
    showCollection({ pages: [], characters: 0, loadingUrl: url.input.value.trim() });
    try {
      const supplied = otherUrls.input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
      const result = await collectStoryPages({ url: url.input.value, linked, otherUrls: linked && supplied.length ? supplied : undefined, signal: controller.signal, onProgress: (progress) => {
        if (!destroyed && webAbort === controller)
          showCollection(progress);
      } }, (pageUrl) => rpc.request("fetch-url", { url: pageUrl }));
      if (destroyed || webAbort !== controller)
        return;
      stagedPages = result;
      loadingPages = false;
      showCollection({ pages: result.pages, characters: result.text.length, loadingUrl: null }, result);
      notify(result.pages.length ? `${result.pages.length} page${result.pages.length === 1 ? "" : "s"} ready for review. Use collected text when you are ready to replace the source.` : result.message, result.pages.length || result.reason === "cancelled" ? "info" : "error");
    } finally {
      if (webAbort === controller) {
        webAbort = null;
        loadingPages = false;
        if (!destroyed) {
          cancelLoading.hidden = true;
          syncImportControls();
        }
      }
    }
  }
  function syncImportControls() {
    const busy = loadingPages || adaptationStarting || connectionChecking || visualsBusy() || snapshot?.job?.status === "running";
    checkConnectionButton.disabled = !!busy || !connection.value;
    connection.disabled = connectionChecking;
    resumeButton.disabled = !!busy || !snapshot?.resume?.available;
    outputAllowance.input.disabled = !!busy;
    reasoningChoice.input.disabled = !!busy;
    resumeAllowance.input.disabled = !!busy;
    resumeReasoning.input.disabled = !!busy;
    importButton.disabled = !!busy;
    fetchButton.disabled = !!busy;
    fetchLinkedButton.disabled = !!busy;
    useCollected.disabled = !!busy || !stagedPages?.pages.length;
    syncVisualControls();
  }
  linkSection.body.append(paragraph("Read one page, or follow its next-page links. Page loading uses no model. Some sites block access; paste text when needed.", "sp-hint"), url.wrap, otherUrls.wrap, row(fetchButton, fetchLinkedButton), paragraph("Up to 100 pages and 500,000 characters. Collected text stays separate until you choose to use it.", "sp-hint"), collectionBox);
  sourceCard.append(sourceTools, fileInput, title.wrap, source.wrap, sourceBottom, linkSection.root);
  panels.import.append(sourceCard);
  const options = node("div", "sp-card sp-stack");
  options.append(node("h3", "", "Make a place for yourself"));
  const role = field("Who will you play?", "", undefined, { placeholder: "An existing character, or someone new", hint: "The narrator leaves this character’s dialogue and choices to you." });
  const start = field("Where does it begin?", "", undefined, { placeholder: "The beginning, a chapter, or a specific moment" });
  const sceneCount = field("Planned scenes", "6", undefined, { type: "number", min: 2, max: 24, hint: "2–24 major moments, including the opening." });
  const connectionWrap = node("div", "sp-field");
  const connectionLabel = node("label", "sp-label", "Adaptation connection");
  const connection = node("select");
  connection.id = `sp-${suffix}-connection`;
  connectionLabel.htmlFor = connection.id;
  connection.append(option("Loading connections…", ""));
  connectionWrap.append(connectionLabel, connection, paragraph("Uses a model connection already configured in Lumiverse.", "sp-hint"));
  const connectionStatus = node("div", "sp-status");
  connectionStatus.setAttribute("role", "status");
  connectionStatus.setAttribute("aria-live", "polite");
  const checkConnectionButton = button("Check connection", async () => {
    if (loadingPages || adaptationStarting || connectionChecking || visualsBusy() || snapshot?.job?.status === "running")
      throw new Error("Wait for the current page loading, connection check, or adaptation to finish.");
    const connectionId = connection.value;
    if (!connectionId)
      throw new Error("Choose an adaptation connection before checking it.");
    connectionChecking = true;
    connectionStatus.dataset.kind = "info";
    connectionStatus.textContent = "Checking the selected connection…";
    syncImportControls();
    try {
      const result = await rpc.request("test-connection", { connectionId });
      if (destroyed)
        return;
      connectionStatus.textContent = `${result.message} A successful check does not guarantee that a full story adaptation will be accepted.`;
    } catch (error) {
      if (!destroyed) {
        connectionStatus.dataset.kind = "error";
        connectionStatus.textContent = errorText(error);
      }
    } finally {
      connectionChecking = false;
      if (!destroyed)
        syncImportControls();
    }
  });
  checkConnectionButton.disabled = true;
  connection.addEventListener("change", () => {
    connectionStatus.textContent = "";
    syncImportControls();
  });
  connectionWrap.append(checkConnectionButton, paragraph("Sends a small test request without your story. Normal model charges apply.", "sp-hint"), connectionStatus);
  const optionGrid = node("div", "sp-grid");
  optionGrid.append(sceneCount.wrap, connectionWrap);
  options.append(role.wrap, start.wrap, optionGrid);
  panels.import.append(options);
  const advanced = details("Long-story settings");
  const chunk = field("Characters per section", "12000", undefined, { type: "number", min: 4000, max: 20000, hint: "Long stories are read in sections, then reconciled into one adaptation. Use a smaller section for models with less context." });
  advanced.body.append(chunk.wrap);
  panels.import.append(advanced.root);
  const responseSettings = details("Model response settings");
  const outputAllowance = selectField("Response allowance", responseAllowances, "16000");
  const reasoningChoice = selectField("Reasoning mode", reasoningModes, "inherit");
  const responseGrid = node("div", "sp-grid");
  responseGrid.append(outputAllowance.wrap, reasoningChoice.wrap);
  responseSettings.body.append(paragraph("Set how much room the model has to answer and whether to override its reasoning setting. Allowances are measured in tokens, which can be words or parts of words.", "sp-hint"), responseGrid, paragraph(responseSettingsHint, "sp-hint"));
  panels.import.append(responseSettings.root);
  const progressBox = node("div", "sp-progress");
  progressBox.hidden = true;
  const progressText = paragraph("", "sp-small");
  const progress = node("progress");
  progress.max = 1;
  progress.value = 0;
  progress.setAttribute("aria-label", "Story import progress");
  const cancel = button("Cancel import", async () => {
    await rpc.request("cancel-import");
    notify("Import cancelled. Your previous draft is still available.");
    await refresh();
  });
  const resumeHint = paragraph("", "sp-hint");
  resumeHint.hidden = true;
  const resumeSettings = node("div", "sp-stack");
  resumeSettings.hidden = true;
  const resumeAllowance = selectField("Unfinished response allowance", responseAllowances, "16000", () => {
    resumeSettingsDirty = true;
  });
  const resumeReasoning = selectField("Unfinished reasoning mode", reasoningModes, "inherit", () => {
    resumeSettingsDirty = true;
  });
  const resumeGrid = node("div", "sp-grid");
  resumeGrid.append(resumeAllowance.wrap, resumeReasoning.wrap);
  resumeSettings.append(node("div", "sp-section-label", "Settings for unfinished requests"), resumeGrid, paragraph(responseSettingsHint, "sp-hint"));
  const resumeButton = button("Resume saved import", async () => {
    if (loadingPages || adaptationStarting || connectionChecking || visualsBusy() || snapshot?.job?.status === "running")
      throw new Error("Wait for page loading, the connection check, or the current adaptation to finish.");
    if (!snapshot?.resume?.available)
      throw new Error("There is no saved import available to resume.");
    const retryUncertain = snapshot.resume.retryUncertain;
    const responseOptions = readResponseSettings(resumeAllowance.input, resumeReasoning.input);
    adaptationStarting = true;
    syncImportControls();
    try {
      const job = await rpc.request("resume-import", { ...responseOptions, ...retryUncertain ? { retryUncertain: true } : {} });
      if (snapshot)
        snapshot.job = job;
      resumeSettingsDirty = false;
      renderJob(job);
      notify("Resuming the saved story. Completed steps are reused; only unfinished requests use your selected response settings.");
      await refresh();
    } finally {
      adaptationStarting = false;
      if (!destroyed)
        syncImportControls();
    }
  }, true);
  resumeButton.hidden = true;
  progressBox.append(progressText, progress, cancel, resumeHint, resumeSettings, resumeButton);
  panels.import.append(progressBox);
  const importButton = button("Create adaptation  →", async () => {
    if (loadingPages || adaptationStarting || connectionChecking || visualsBusy() || snapshot?.job?.status === "running")
      throw new Error("Wait for page loading, the connection check, or the current adaptation to finish.");
    if (!source.input.value.trim())
      throw new Error("Add story text before creating an adaptation.");
    if (!connection.value)
      throw new Error("Choose an adaptation connection. Add one in Lumiverse settings if the list is empty.");
    const sceneNumber = Number(sceneCount.input.value), chunkNumber = Number(chunk.input.value);
    if (!Number.isInteger(sceneNumber) || sceneNumber < 2 || sceneNumber > 24)
      throw new Error("Choose between 2 and 24 scenes.");
    if (!Number.isInteger(chunkNumber) || chunkNumber < 4000 || chunkNumber > 20000)
      throw new Error("Section size must be between 4,000 and 20,000 characters.");
    const options = { text: source.input.value, sourceTitle: title.input.value.trim(), sourceUrl: appliedSourceUrl, playerRole: role.input.value.trim(), startingPoint: start.input.value.trim(), sceneCount: sceneNumber, connectionId: connection.value, chunkSize: chunkNumber, ...readResponseSettings(outputAllowance.input, reasoningChoice.input) };
    adaptationStarting = true;
    syncImportControls();
    try {
      const job = await rpc.request("start-import", { options });
      if (snapshot)
        snapshot.job = job;
      renderJob(job);
      notify("Your story is being adapted. You can leave this panel open or return later.");
      await refresh();
    } finally {
      adaptationStarting = false;
      if (!destroyed)
        syncImportControls();
    }
  }, true);
  importButton.classList.add("sp-wide");
  panels.import.append(importButton, paragraph("Creates a draft for you to review. Reading, planning, and each character, lore, or scene batch use your model’s normal charges. Completed steps are saved for reuse.", "sp-footnote"));
  function updateSourceCount() {
    count.textContent = `${source.input.value.length.toLocaleString()} characters`;
    syncVisualControls();
  }
  function renderJob(job) {
    const running = job?.status === "running";
    const canResume = !!snapshot?.resume?.available && !running;
    progressBox.hidden = !job && !canResume;
    cancel.hidden = !running;
    resumeButton.hidden = !canResume;
    resumeHint.hidden = !canResume;
    resumeSettings.hidden = !canResume;
    if (canResume && (!resumeSettingsDirty || resumeSettingsJobId !== (job?.id ?? null))) {
      resumeSettingsJobId = job?.id ?? null;
      resumeSettingsDirty = false;
      const savedAllowance = snapshot?.resume?.maxOutputTokens ?? 16000;
      resumeAllowance.input.value = [8000, 16000, 32000, 64000].includes(savedAllowance) ? String(savedAllowance) : "16000";
      const savedReasoning = snapshot?.resume?.reasoningMode ?? "inherit";
      resumeReasoning.input.value = ["inherit", "off", "low"].includes(savedReasoning) ? savedReasoning : "inherit";
    }
    resumeButton.textContent = snapshot?.resume?.retryUncertain ? "Retry unfinished request" : "Resume saved import";
    resumeHint.textContent = "Uses the saved story and import settings, not the edits in the current form. Completed steps are reused even when you change the response settings below; remaining requests use normal model charges." + (snapshot?.resume?.retryUncertain ? " Its previous outcome is unknown and it may already have been charged. Retrying can charge that request again." : "");
    syncImportControls();
    if (job) {
      progressText.textContent = job.status === "failed" && job.phase ? `Stopped during ${job.phase}. ${job.error || job.label}` : job.error || job.label;
      progress.max = Math.max(1, job.total);
      progress.value = Math.min(job.completed, progress.max);
    }
    const anyRunning = running || snapshot?.visuals?.job?.status === "running";
    if (anyRunning && !polling)
      polling = setInterval(() => {
        refresh();
      }, 2500);
    if (!anyRunning && polling) {
      clearInterval(polling);
      polling = undefined;
    }
    tab.setBadge(anyRunning ? "…" : null);
  }
  function updateConnections(next) {
    const signature = JSON.stringify(next.connections);
    if (connection.dataset.signature === signature)
      return;
    const current = connection.value;
    connection.replaceChildren();
    connection.dataset.signature = signature;
    if (!next.connections.length)
      connection.append(option("Add a model connection in Settings", ""));
    for (const entry of next.connections)
      connection.append(option(`${entry.name}${entry.model ? ` · ${entry.model}` : ""}`, entry.id));
    if (next.connections.some((item) => item.id === current))
      connection.value = current;
  }
  const visualPanel = details("Image descriptions · optional").root;
  const visualBody = visualPanel.querySelector(".sp-stack");
  const visualInfo = paragraph("Reads the original story again for appearance details. Uses normal text-model charges; it does not generate images.", "sp-hint");
  const visualSourceNotice = paragraph("", "sp-notice");
  const visualSource = field("Original story for these descriptions", "", undefined, { area: true, rows: 5, hint: "Paste the original story for this draft. Review it before creating descriptions. This stays separate from your Import form." });
  visualSource.input.maxLength = MAX_SOURCE;
  const visualSources = new Map;
  const visualSourceOverrides = new Set;
  let visualSourceKey = "";
  visualSource.input.addEventListener("input", () => {
    visualSources.set(visualSourceKey, visualSource.input.value);
    syncVisualControls();
  });
  const copyImportSource = button("Use story text from Import", () => {
    visualSource.input.value = source.input.value;
    visualSources.set(visualSourceKey, source.input.value);
    notify("Story text copied from Import for your review. Check that it belongs to this draft before creating descriptions.");
    syncVisualControls();
  });
  const visualWebsite = details("Read the original story from a website");
  const visualWebsiteUrl = field("Story website for descriptions", "", undefined, { type: "url", placeholder: "https://…" });
  const visualWebsitePages = field("Other description page links", "", undefined, { area: true, rows: 2, hint: "Optional: other pages in reading order. Leave blank to follow the website’s next-page links." });
  visualWebsitePages.input.maxLength = 409600;
  const visualWebSources = new Map, visualCollections = new Map;
  for (const input of [visualWebsiteUrl.input, visualWebsitePages.input])
    input.addEventListener("input", () => visualWebSources.set(visualSourceKey, { url: visualWebsiteUrl.input.value, pages: visualWebsitePages.input.value }));
  const visualWebsiteStatus = paragraph("", "sp-hint");
  visualWebsiteStatus.setAttribute("role", "status");
  const visualWebsiteUse = button("Use website text for descriptions", () => {
    if (otherWorkBusy() || visualsBusy())
      throw new Error("Wait for the current operation to finish before choosing story text.");
    const collection = visualCollections.get(visualSourceKey);
    if (!collection?.pages.length)
      throw new Error("Read the story website first.");
    visualSource.input.value = collection.text;
    visualSources.set(visualSourceKey, collection.text);
    visualSourceOverrides.add(visualSourceKey);
    notify(`${collection.pages.length} pages selected for image descriptions. Review the story text and page count before creating descriptions.`);
    syncVisualControls();
  });
  visualWebsiteUse.hidden = true;
  const visualWebsiteCancel = button("Cancel website loading", () => webAbort?.abort());
  visualWebsiteCancel.hidden = true;
  const visualWebsiteRead = button("Read linked story pages", async () => {
    if (otherWorkBusy() || visualsBusy())
      throw new Error("Wait for the current operation to finish before reading story pages.");
    const signature = visualSourceKey, controller = new AbortController;
    webAbort = controller;
    loadingPages = true;
    visualCollections.delete(signature);
    visualWebsiteUse.hidden = true;
    visualWebsiteCancel.hidden = false;
    syncImportControls();
    const selectedUrl = visualWebsiteUrl.input.value, supplied = visualWebsitePages.input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    try {
      const result = await collectStoryPages({ url: selectedUrl, linked: true, otherUrls: supplied.length ? supplied : undefined, signal: controller.signal, onProgress: (progress) => {
        if (!destroyed && visualSourceKey === signature)
          visualWebsiteStatus.textContent = `${progress.pages.length} pages collected · ${progress.characters.toLocaleString()} characters${progress.loadingUrl ? " · reading next page…" : ""}`;
      } }, (pageUrl) => rpc.request("fetch-url", { url: pageUrl }));
      if (destroyed || webAbort !== controller)
        return;
      visualCollections.set(signature, result);
      if (visualSourceKey === signature) {
        visualWebsiteStatus.textContent = `${result.pages.length} pages collected · ${result.text.length.toLocaleString()} characters. ${result.message}`;
        visualWebsiteUse.hidden = !result.pages.length;
      }
      notify(result.pages.length ? "Website text is ready. Check the page count, then choose Use website text for descriptions." : result.message, result.pages.length || result.reason === "cancelled" ? "info" : "error");
    } finally {
      if (webAbort === controller) {
        webAbort = null;
        loadingPages = false;
        if (!destroyed) {
          visualWebsiteCancel.hidden = true;
          syncImportControls();
        }
      }
    }
  });
  visualWebsite.body.append(paragraph("Reads all linked pages using the same website importer as Import. This makes no model request and does not replace your completed draft.", "sp-hint"), visualWebsiteUrl.wrap, visualWebsitePages.wrap, visualWebsiteRead, visualWebsiteCancel, visualWebsiteStatus, visualWebsiteUse);
  const visualSourceBox = group(visualWebsite.root, visualSource.wrap, copyImportSource);
  const replaceVisualSource = button("Use different story text", () => {
    if (draft) {
      visualSourceOverrides.add(visualDraftSignature(draft));
      renderVisuals();
      visualSource.input.focus();
    }
  });
  const visualConnection = selectField("Image description connection", [], "");
  const visualSettings = details("Description response settings");
  let visualSettingsDirty = false;
  let visualSettingsJobId;
  const visualAllowance = selectField("Description response allowance", responseAllowances, "16000", () => {
    visualSettingsDirty = true;
  });
  const visualReasoning = selectField("Description reasoning mode", reasoningModes, "inherit", () => {
    visualSettingsDirty = true;
  });
  const visualSettingsGrid = node("div", "sp-grid");
  visualSettingsGrid.append(visualAllowance.wrap, visualReasoning.wrap);
  visualSettings.body.append(visualSettingsGrid, paragraph(responseSettingsHint, "sp-hint"));
  const visualProgress = node("div", "sp-progress");
  visualProgress.hidden = true;
  const visualProgressText = paragraph("", "sp-small");
  visualProgressText.setAttribute("role", "status");
  visualProgressText.setAttribute("aria-live", "polite");
  const visualProgressBar = node("progress");
  visualProgressBar.max = 1;
  visualProgressBar.value = 0;
  visualProgressBar.setAttribute("aria-label", "Image description progress");
  const visualCancel = button("Cancel descriptions", async () => {
    await rpc.request("cancel-visuals");
    notify("Description cancellation requested. Completed steps are retained.");
    await refresh();
  });
  const visualResumeHint = paragraph("", "sp-hint");
  const visualResume = button("Resume saved descriptions", async () => {
    if (otherWorkBusy() || visualsBusy())
      throw new Error("Wait for the current operation to finish before resuming descriptions.");
    if (!snapshot?.visuals?.resumeAvailable || !draft || snapshot.visuals.requestSignature !== visualDraftSignature(draft))
      throw new Error("The saved descriptions belong to a different version of the draft.");
    const retryUncertain = snapshot.visuals.retryUncertain;
    visualsStarting = true;
    syncImportControls();
    try {
      await rpc.request("resume-visuals", { ...readResponseSettings(visualAllowance.input, visualReasoning.input), ...retryUncertain ? { retryUncertain: true } : {} });
      visualSettingsDirty = false;
      notify("Resuming the saved description request. Current story edits and source fields are unchanged.");
      await refresh();
    } finally {
      visualsStarting = false;
      if (!destroyed)
        syncImportControls();
    }
  });
  visualProgress.append(visualProgressText, visualProgressBar, visualCancel, visualResumeHint, visualResume);
  const visualCreate = button("Create image descriptions", async () => {
    if (otherWorkBusy() || visualsBusy())
      throw new Error("Wait for the current operation to finish before creating descriptions.");
    if (!draft)
      throw new Error("Create or open a story draft first.");
    const requested = clone(draft), signature = visualDraftSignature(requested), sourceBound = snapshot?.visuals?.sourceSignature === signature && !visualSourceOverrides.has(signature);
    if (!visualConnection.input.value)
      throw new Error("Choose an image description connection.");
    const sourceText = visualSource.input.value;
    if (!sourceBound && (sourceText.trim().length < 100 || sourceText.length > MAX_SOURCE))
      throw new Error("Supply between 100 and 500,000 characters of the original story for these descriptions.");
    visualsStarting = true;
    syncImportControls();
    try {
      await rpc.request("start-visuals", { draft: requested, connectionId: visualConnection.input.value, ...readResponseSettings(visualAllowance.input, visualReasoning.input), ...!sourceBound ? { sourceText } : {} });
      visualSourceOverrides.delete(signature);
      visualSettingsDirty = false;
      notify("Creating optional image descriptions. Your story draft remains editable.");
      await refresh();
    } finally {
      visualsStarting = false;
      if (!destroyed)
        syncImportControls();
    }
  }, true);
  const visualResultNotice = paragraph("", "sp-notice");
  visualResultNotice.hidden = true;
  visualResultNotice.dataset.visualResultNotice = "";
  const visualResults = node("div", "sp-stack");
  const visualEditors = new Map;
  let visualEditorKey = "";
  let visualEditorRef;
  const loadVisualResult = button("Load new descriptions", () => {
    const current = snapshot?.visuals;
    if (!draft || !current?.pack || current.resultSignature !== visualDraftSignature(draft))
      return;
    visualEditors.set(current.resultSignature, { pack: clone(current.pack), dirty: false, serverVersion: JSON.stringify(current.pack) });
    visualEditorRef = undefined;
    renderVisuals();
    notify("New descriptions loaded.");
  });
  loadVisualResult.hidden = true;
  visualBody.append(visualInfo, visualSourceNotice, replaceVisualSource, visualSourceBox, visualConnection.wrap, visualSettings.root, visualCreate, visualProgress, visualResultNotice, loadVisualResult, visualResults);
  function visualsBusy() {
    return visualsStarting || snapshot?.visuals?.job?.status === "running";
  }
  function otherWorkBusy() {
    return loadingPages || adaptationStarting || connectionChecking || snapshot?.job?.status === "running";
  }
  function syncVisualControls() {
    const busy = !!(otherWorkBusy() || visualsBusy());
    visualCreate.disabled = busy || !draft || !visualConnection.input.value;
    visualResume.disabled = busy || !snapshot?.visuals?.resumeAvailable || !draft || snapshot.visuals.requestSignature !== visualDraftSignature(draft);
    visualConnection.input.disabled = busy;
    visualAllowance.input.disabled = busy;
    visualReasoning.input.disabled = busy;
    visualSource.input.disabled = busy;
    replaceVisualSource.disabled = busy;
    copyImportSource.disabled = busy || !source.input.value.trim();
    visualWebsiteRead.disabled = busy;
    visualWebsiteUse.disabled = busy;
    visualWebsiteUrl.input.disabled = busy;
    visualWebsitePages.input.disabled = busy;
  }
  async function copyVisualText(value, field, label) {
    if (!value.trim())
      throw new Error(`There is no ${label.toLowerCase()} to copy yet.`);
    try {
      const clipboard = field.ownerDocument.defaultView?.navigator.clipboard;
      if (!clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await clipboard.writeText(value);
      notify(`${label} copied.`);
    } catch {
      field.focus();
      field.select();
      notify("Clipboard access is unavailable. The text is selected; copy it using your keyboard or context menu.");
    }
  }
  function renderVisualEditor(editor, signature) {
    visualResults.replaceChildren();
    const pack = editor.pack;
    const badge = node("span", "sp-tag", editor.dirty ? "Unsaved description edits" : "Descriptions ready");
    visualResults.append(badge);
    const change = () => {
      editor.dirty = true;
      badge.textContent = "Unsaved description edits";
      for (const update of approvedControls.values())
        update();
    };
    for (const warning of pack.warnings)
      visualResults.append(paragraph(warning, "sp-notice"));
    const copyHint = paragraph("Copy appearance tags and outfit tags into the corresponding Lumi Studio fields. Use the combined Anima tags or caption for a prompt. Suggested details are excluded until you choose to include them. No images are generated or sent automatically.", "sp-hint");
    visualResults.append(copyHint);
    for (const profile of pack.profiles) {
      let updatePrompts = function() {
        tags.input.value = visualTagPrompt(profile, includeSuggestions);
        caption.input.value = visualCaption(profile, includeSuggestions);
      };
      const name = draft?.cast.find((person) => person.id === profile.characterId)?.name ?? profile.characterId;
      const entry = details(name);
      let includeSuggestions = false;
      const editable = (label, value, assign, hint) => field(label, value, (v) => {
        assign(v);
        change();
        updatePrompts();
      }, { area: true, rows: 3, hint });
      const appearance = editable(`${name}: appearance from the story`, profile.description, (v) => profile.description = v, "Source facts only. Keep invented choices in Suggested details below.");
      const outfit = editable(`${name}: starting outfit from the story`, profile.startingOutfit, (v) => profile.startingOutfit = v);
      const subject = editable(`${name}: caption subject`, profile.subject, (v) => profile.subject = v);
      const count = selectField(`${name}: Anima subject tag`, [["", "No count tag"], ["1girl", "1girl"], ["1boy", "1boy"], ["1other", "1other"]], profile.countTag, () => {
        profile.countTag = count.input.value;
        change();
        updatePrompts();
      });
      const tagField = (label, values, assign, limit = 32) => editable(label, values.join(", "), (v) => assign(v.split(",").map((tag) => tag.trim()).filter(Boolean)), `Up to ${limit} tags, separated by commas. Use short, lowercase descriptions.`);
      const appearanceTags = tagField(`${name}: appearance tags`, profile.appearanceTags, (v) => profile.appearanceTags = v);
      const outfitTags = tagField(`${name}: outfit tags`, profile.outfitTags, (v) => profile.outfitTags = v, 12);
      const suggestions = details("Suggested details · not source facts");
      const suggested = editable(`${name}: suggested details`, profile.suggestedDetails, (v) => profile.suggestedDetails = v);
      const suggestedTags = tagField(`${name}: suggested tags`, profile.suggestedTags, (v) => profile.suggestedTags = v);
      suggestions.body.append(suggested.wrap, suggestedTags.wrap);
      const include = node("input");
      include.type = "checkbox";
      include.setAttribute("aria-label", `${name}: include suggested details in copied prompts`);
      include.style.width = "auto";
      const includeLabel = node("label", "sp-small", "Include suggested details in copied prompts");
      includeLabel.prepend(include);
      include.addEventListener("change", () => {
        includeSuggestions = include.checked;
        updatePrompts();
      });
      const tags = field(`${name}: Anima tags to copy`, "", undefined, { area: true, rows: 3 });
      tags.input.readOnly = true;
      const caption = field(`${name}: caption to copy`, "", undefined, { area: true, rows: 3 });
      caption.input.readOnly = true;
      updatePrompts();
      entry.body.append(appearance.wrap, button(`Copy ${name} appearance`, () => copyVisualText(profile.description, appearance.input, "Appearance")), outfit.wrap, button(`Copy ${name} outfit`, () => copyVisualText(profile.startingOutfit, outfit.input, "Outfit")), subject.wrap, count.wrap, appearanceTags.wrap, button(`Copy ${name} appearance tags`, () => copyVisualText(profile.appearanceTags.join(", "), appearanceTags.input, "Appearance tags")), outfitTags.wrap, button(`Copy ${name} outfit tags`, () => copyVisualText(profile.outfitTags.join(", "), outfitTags.input, "Outfit tags")), suggestions.root);
      if (profile.unknowns.length) {
        entry.body.append(node("span", "sp-label", "Not established in the source"));
        for (const unknown of profile.unknowns)
          entry.body.append(paragraph(unknown, "sp-notice"));
      }
      if (profile.sourceRefs.length)
        entry.body.append(paragraph(`Source: ${profile.sourceRefs.join(" · ")}`, "sp-hint"));
      entry.body.append(includeLabel, tags.wrap, button(`Copy ${name} Anima tags`, () => copyVisualText(tags.input.value, tags.input, "Anima tags")), caption.wrap, button(`Copy ${name} caption`, () => copyVisualText(caption.input.value, caption.input, "Caption")));
      visualResults.append(entry.root);
    }
    visualResults.append(button("Use these appearances in story", () => {
      if (!draft || visualDraftSignature(draft) !== signature)
        throw new Error("These descriptions belong to an earlier version of the draft.");
      for (const profile of pack.profiles) {
        if (!draft.cast.some((person) => person.id === profile.characterId))
          continue;
        const approved = { characterId: profile.characterId, description: profile.description === UNSPECIFIED_APPEARANCE ? "" : profile.description, startingOutfit: profile.startingOutfit === UNSPECIFIED_APPEARANCE ? "" : profile.startingOutfit };
        const index = draft.appearances?.findIndex((item) => item.characterId === profile.characterId) ?? -1;
        if (index >= 0)
          draft.appearances[index] = approved;
        else
          (draft.appearances ??= []).push(approved);
      }
      draftDirty = true;
      renderReview();
      notify("Source appearances copied into the approved story fields. Review them, then Save draft or Save to Lumiverse. Suggestions were not copied.");
    }), paragraph("Replaces the approved appearance and starting outfit fields with the source facts shown here. Unspecified details stay blank. Suggested details are not copied; choose them yourself in the approved fields if wanted.", "sp-hint"));
    visualResults.append(row(button("Save descriptions", async () => {
      if (!draft || visualDraftSignature(draft) !== signature)
        throw new Error("These descriptions belong to an earlier version of the draft.");
      const requested = clone(pack), fingerprint = JSON.stringify(requested);
      await rpc.request("save-visuals", { draft: clone(draft), pack: requested });
      if (JSON.stringify(editor.pack) === fingerprint) {
        editor.dirty = false;
        editor.serverVersion = fingerprint;
        badge.textContent = "Descriptions saved";
      }
      notify("Image descriptions saved separately from your story draft.");
      await refresh();
    }), button("Export descriptions", () => download(`${draft?.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "set-points"}-image-descriptions.json`, pack))));
  }
  function renderVisuals() {
    if (!draft)
      return;
    const signature = visualDraftSignature(draft), visuals = snapshot?.visuals;
    if (visualSourceKey !== signature) {
      visualSourceKey = signature;
      visualSource.input.value = visualSources.get(signature) ?? "";
      const website = visualWebSources.get(signature);
      visualWebsiteUrl.input.value = website?.url ?? draft.source.url ?? "";
      visualWebsitePages.input.value = website?.pages ?? "";
      const collection = visualCollections.get(signature);
      visualWebsiteUse.hidden = !collection?.pages.length;
      visualWebsiteStatus.textContent = collection ? `${collection.pages.length} pages collected. ${collection.message}` : "";
    }
    const sourceBound = visuals?.sourceSignature === signature && !visualSourceOverrides.has(signature);
    visualSourceBox.hidden = sourceBound;
    replaceVisualSource.hidden = !sourceBound;
    visualSourceNotice.textContent = sourceBound ? "The original source is saved for this draft; Resume uses it without pasting again." : "Choose the original story below: read its website, paste the text, or copy it from Import. Older drafts may need this once. Your completed adaptation is kept.";
    const connectionsSignature = JSON.stringify(snapshot?.connections ?? []);
    if (visualConnection.input.dataset.signature !== connectionsSignature) {
      const previous = visualConnection.input.value;
      visualConnection.input.replaceChildren();
      visualConnection.input.dataset.signature = connectionsSignature;
      for (const item of snapshot?.connections ?? [])
        visualConnection.input.append(option(`${item.name}${item.model ? ` · ${item.model}` : ""}`, item.id));
      if (!visualConnection.input.options.length)
        visualConnection.input.append(option("Add a model connection in Settings", ""));
      if ((snapshot?.connections ?? []).some((item) => item.id === previous))
        visualConnection.input.value = previous;
      else if (visuals?.connectionId && (snapshot?.connections ?? []).some((item) => item.id === visuals.connectionId))
        visualConnection.input.value = visuals.connectionId;
    }
    const job = visuals?.job, running = job?.status === "running", requestMatches = visuals?.requestSignature === signature, canResume = !!visuals?.resumeAvailable && !running && requestMatches;
    if (!visualSettingsDirty || visualSettingsJobId !== (job?.id ?? null)) {
      visualSettingsJobId = job?.id ?? null;
      visualSettingsDirty = false;
      visualAllowance.input.value = String(visuals?.maxOutputTokens ?? 16000);
      visualReasoning.input.value = visuals?.reasoningMode ?? "inherit";
    }
    visualProgress.hidden = !job && !canResume;
    visualCancel.hidden = !running;
    visualResume.hidden = !canResume;
    visualResumeHint.hidden = !canResume;
    if (job) {
      visualProgressText.textContent = (!requestMatches ? "Descriptions for another version of the draft. " : "") + (job.status === "failed" && job.phase ? `Stopped during ${job.phase}. ${job.error || job.label}` : job.error || job.label);
      visualProgressBar.max = Math.max(1, job.total);
      visualProgressBar.value = Math.min(job.completed, visualProgressBar.max);
    }
    visualResume.textContent = visuals?.retryUncertain ? "Retry unfinished description request" : "Resume saved descriptions";
    visualResumeHint.textContent = "Resumes the saved draft and source, independent of current edits. Completed steps are reused; remaining requests use normal model charges." + (visuals?.retryUncertain ? " Its previous outcome is unknown and it may already have been charged. Retrying can charge that request again." : "");
    const matching = !!visuals?.pack && visuals.resultSignature === signature;
    let editor = visualEditors.get(signature);
    if (matching) {
      const version = JSON.stringify(visuals.pack);
      if (!editor || !editor.dirty && editor.serverVersion !== version) {
        editor = { pack: clone(visuals.pack), dirty: false, serverVersion: version };
        visualEditors.set(signature, editor);
      }
    }
    const newer = !!(matching && editor?.dirty && editor.serverVersion !== JSON.stringify(visuals?.pack));
    loadVisualResult.hidden = !newer;
    visualResultNotice.hidden = !(newer || !matching && (visuals?.pack || visualEditors.size));
    if (!matching)
      editor = undefined;
    visualResultNotice.textContent = newer ? "New descriptions are ready. Loading them replaces your unsaved description edits." : "Descriptions for a different version of the draft are hidden. Your story edits and saved descriptions are preserved.";
    if (visualEditorKey !== signature || visualEditorRef !== editor) {
      visualEditorKey = signature;
      visualEditorRef = editor;
      if (editor)
        renderVisualEditor(editor, signature);
      else
        visualResults.replaceChildren();
    }
    for (const update of approvedControls.values())
      update();
    syncVisualControls();
  }
  const draftFileInput = node("input");
  draftFileInput.type = "file";
  draftFileInput.accept = ".json,application/json";
  draftFileInput.hidden = true;
  draftFileInput.setAttribute("aria-label", "Open saved Set Points draft");
  app.append(draftFileInput);
  const openDraftButton = button("Open draft", () => draftFileInput.click());
  const pasteDraftPanel = node("section", "sp-card sp-stack");
  pasteDraftPanel.hidden = true;
  pasteDraftPanel.setAttribute("aria-label", "Restore draft backup");
  const pastedDraft = field("Paste draft JSON", "", undefined, { area: true, rows: 10, hint: "Paste a complete Set Points story-draft backup. Opening it replaces the current Review draft only after validation." });
  const pasteDraftButton = button("Paste draft backup", () => {
    pasteDraftPanel.hidden = false;
    pastedDraft.input.focus();
  });
  const openPastedDraft = button("Open pasted draft", async () => {
    await restoreDraftText(pastedDraft.input.value);
    pasteDraftPanel.hidden = true;
  });
  pasteDraftPanel.append(node("h3", "", "Restore a draft backup"), pastedDraft.wrap, row(openPastedDraft, button("Close restore", () => {
    pasteDraftPanel.hidden = true;
  })));
  app.insertBefore(pasteDraftPanel, panels.import);
  async function restoreDraftText(text) {
    if (openingDraft)
      throw new Error("Wait for the current draft to finish opening.");
    openingDraft = true;
    try {
      if (text.length > MAX_BACKUP)
        throw new Error("This draft backup is too large. Open a backup with up to 384,000 characters; the validated story draft must fit within 192,000 characters.");
      let imported;
      try {
        imported = JSON.parse(text);
      } catch {
        throw new Error("This backup could not be read. Use a complete Set Points draft exported from Review.");
      }
      const before = JSON.stringify(draft), revision = draftRevision;
      notify("Checking the saved draft…");
      const restored = await rpc.request("save-draft", { draft: imported });
      if (destroyed)
        return;
      if (snapshot)
        snapshot.draft = clone(restored);
      if (JSON.stringify(draft) !== before || draftRevision !== revision) {
        pendingReplacement = clone(restored);
        newDraftNotice.hidden = false;
        selectTab("review");
        notify("The backup was validated and saved. Your newer Review edits were kept. Choose Load new draft when ready to replace them.");
        return;
      }
      draft = clone(restored);
      pendingReplacement = null;
      draftDirty = false;
      draftRevision++;
      draftVersion = JSON.stringify(restored);
      newDraftNotice.hidden = true;
      renderReview();
      selectTab("review");
      notify("Draft opened and saved. Review it before saving the character card.");
    } finally {
      openingDraft = false;
    }
  }
  draftFileInput.addEventListener("change", () => void run(openDraftButton, async () => {
    const file = draftFileInput.files?.[0];
    if (!file)
      return;
    try {
      if (!/\.json$/i.test(file.name))
        throw new Error("Choose a Set Points draft saved as a .json file.");
      if (file.size > MAX_BACKUP * 4)
        throw new Error("This draft file is too large. Open a backup with up to 384,000 characters.");
      await restoreDraftText(await file.text());
    } finally {
      draftFileInput.value = "";
    }
  }));
  function renderReview() {
    const panel = panels.review;
    panel.replaceChildren();
    panelNonce++;
    approvedControls.clear();
    if (!draft) {
      const top = intro("Meet your adaptation", "A little preparation makes room for a better story.");
      top.append(row(openDraftButton, pasteDraftButton));
      panel.append(top);
      const empty = node("div", "sp-empty");
      empty.append(node("span", "sp-tag", "Your draft belongs here"), paragraph("Import a story to review its cast, lore, and scene openings."), button("Bring in a story", () => selectTab("import"), true));
      panel.append(empty);
      return;
    }
    const current = draft;
    const nonce = panelNonce;
    const top = intro("Make it yours", "Edit the cast, the world, and the moments you want to reach.");
    const dirtyTag = node("span", "sp-tag", draftDirty ? "Unsaved edits" : "Draft ready");
    top.append(group(dirtyTag, row(openDraftButton, pasteDraftButton)));
    panel.append(top);
    const markDirty = () => {
      draftDirty = true;
      dirtyTag.textContent = "Unsaved edits";
      renderVisuals();
    };
    const reviewFields = new Map;
    const edit = (label, value, change, area = false, hint, key) => {
      const item = field(label, value, (v) => {
        change(v);
        markDirty();
      }, { area, hint });
      if (key)
        reviewFields.set(key, item.input);
      return item.wrap;
    };
    const summary = node("div", "sp-card sp-stack");
    summary.append(edit("Title", current.title, (v) => current.title = v, false, undefined, "title"), edit("Premise", current.premise, (v) => current.premise = v, true, undefined, "premise"));
    const choices = node("div", "sp-grid");
    choices.append(edit("Your role", current.playerRole, (v) => current.playerRole = v, false, undefined, "playerRole"), edit("Starting point", current.startingPoint, (v) => current.startingPoint = v, false, undefined, "startingPoint"));
    summary.append(choices);
    const counts = node("div", "sp-counts");
    for (const [number, label] of [[current.cast.length, "characters"], [current.lore.length, "lore entries"], [current.scenes.length, "scenes"]]) {
      const item = node("div");
      item.append(node("strong", "", String(number)), node("span", "", label));
      counts.append(item);
    }
    summary.append(counts);
    panel.append(summary);
    if (current.warnings.length) {
      const warnings = details(`${current.warnings.length} adaptation note${current.warnings.length === 1 ? "" : "s"}`);
      for (const warning of current.warnings)
        warnings.body.append(paragraph(warning, "sp-notice"));
      panel.append(warnings.root);
    }
    const narration = details("Narrator direction");
    narration.body.append(edit("Instructions", current.narratorInstructions, (v) => current.narratorInstructions = v, true, "Describe the narrator’s scope and how it should leave your choices open.", "narratorInstructions"));
    panel.append(narration.root);
    const cast = node("div", "sp-review-group");
    cast.append(node("div", "sp-section-label", "The people"));
    const appearanceGuide = group(node("h3", "", "Appearance guide"), paragraph("Your approved appearance and starting outfit are the story’s reference, ahead of conflicting incidental descriptions. Blank fields stay unspecified. These choices are included in the draft and become lorebook guidance when saved to Lumiverse; editing them uses no model.", "sp-small"), paragraph("Review existing lore and scene openings for conflicting details. Saved or forced scene openings are literal text and are not automatically rewritten. The narrator may still need corrections.", "sp-hint"));
    appearanceGuide.classList.add("sp-card");
    cast.append(appearanceGuide);
    for (const person of current.cast) {
      let updateApproved = function() {
        const choice = approved();
        approvedCaption.input.value = [choice?.description, choice?.startingOutfit].map((value) => value?.trim() ?? "").filter(Boolean).join(" ");
        approvedCopy.disabled = !approvedCaption.input.value;
        const signature = visualDraftSignature(current), profile = snapshot?.visuals?.resultSignature === signature ? visualEditors.get(signature)?.pack.profiles.find((item) => item.characterId === person.id) : undefined;
        const normalized = (value) => value === UNSPECIFIED_APPEARANCE ? "" : value.trim().replace(/\s+/g, " ");
        appearanceMismatch.hidden = !(choice && profile && (normalized(choice.description) !== normalized(profile.description) || normalized(choice.startingOutfit) !== normalized(profile.startingOutfit)));
      };
      const entry = details(person.name);
      entry.body.append(edit("Name", person.name, (v) => {
        person.name = v;
        entry.summary.textContent = v;
      }, false, undefined, `cast:${person.id}:name`), edit("Also known as", person.aliases.join(", "), (v) => person.aliases = v.split(",").map((x) => x.trim()).filter(Boolean), false, undefined, `cast:${person.id}:aliases`), edit("Personality", person.personality, (v) => person.personality = v, true, undefined, `cast:${person.id}:personality`), edit("Voice & manner", person.voice, (v) => person.voice = v, true, undefined, `cast:${person.id}:voice`), edit("Relationships at the start", person.relationships, (v) => person.relationships = v, true, undefined, `cast:${person.id}:relationships`), edit("Knowledge at the start", person.knowledge, (v) => person.knowledge = v, true, undefined, `cast:${person.id}:knowledge`));
      const approved = () => current.appearances?.find((item) => item.characterId === person.id);
      const setApproved = (key, value) => {
        let appearance = approved();
        if (!appearance) {
          appearance = { characterId: person.id, description: "", startingOutfit: "" };
          (current.appearances ??= []).push(appearance);
        }
        appearance[key] = value;
        updateApproved();
      };
      const approvedCaption = field(`${person.name}: approved caption to copy`, "", undefined, { area: true, rows: 2, hint: "Copies only the appearance and outfit you approved. Free text is not automatically converted to image tags." });
      approvedCaption.input.readOnly = true;
      const approvedCopy = button(`Copy ${person.name} approved caption`, () => copyVisualText(approvedCaption.input.value, approvedCaption.input, "Approved caption"));
      const appearanceMismatch = paragraph("Your approved look differs from the source-analysis descriptions. The source tag and caption buttons still contain that older look. Use the approved caption here, or deliberately update the source-analysis fields before copying their prompts.", "sp-notice");
      appearanceMismatch.hidden = true;
      approvedControls.set(person.id, updateApproved);
      updateApproved();
      entry.body.append(edit(`${person.name}: approved appearance`, approved()?.description ?? "", (v) => setApproved("description", v), true, "Your chosen physical details. Leave blank when unspecified. This is independent of generated source facts."), edit(`${person.name}: approved starting outfit`, approved()?.startingOutfit ?? "", (v) => setApproved("startingOutfit", v), true, "Your chosen outfit at the start. Leave blank when unspecified. Edit conflicting lore or scene openings separately."), appearanceMismatch, approvedCaption.wrap, approvedCopy);
      if (person.sourceRefs.length)
        entry.body.append(paragraph(`Source: ${person.sourceRefs.join(" · ")}`, "sp-hint"));
      cast.append(entry.root);
    }
    panel.append(cast);
    const mentions = details("Check for conflicting looks · optional");
    const mentionResults = group(), mentionStatus = paragraph("", "sp-hint");
    mentionStatus.setAttribute("role", "status");
    let foundMentions = [], shownMentions = 0;
    const showMoreMentions = button("Show more excerpts", () => showMentions());
    showMoreMentions.hidden = true;
    function showMentions() {
      const next = foundMentions.slice(shownMentions, shownMentions + 8);
      for (const mention of next) {
        const open = button("Open location", () => {
          const target = reviewFields.get(mention.fieldKey);
          if (!target)
            return;
          for (let parent = target;parent; parent = parent.parentElement)
            if (parent.tagName === "DETAILS")
              parent.open = true;
          target.scrollIntoView?.({ block: "center", behavior: "smooth" });
          target.focus();
        });
        mentionResults.append(group(node("span", "sp-label", mention.location), paragraph(mention.text, "sp-small"), open));
      }
      shownMentions += next.length;
      showMoreMentions.hidden = shownMentions >= foundMentions.length;
      mentionStatus.textContent = foundMentions.length ? `Showing ${shownMentions} of ${foundMentions.length} short excerpts. These are possible mentions, not confirmed conflicts.` : "No matching appearance words found. Other descriptions may still exist.";
    }
    const scanMentions = button("Scan appearance mentions", () => {
      foundMentions = appearanceMentions(current);
      shownMentions = 0;
      mentionResults.replaceChildren();
      showMentions();
      scanMentions.textContent = "Refresh appearance mentions";
    });
    mentions.body.append(paragraph("Use this only if you want to check an existing look against your approved description. You do not need to read whole passages: compare the short snippets, then Open location to edit any conflicting detail. Ordinary glances and clothing changes may be fine.", "sp-hint"), scanMentions, mentionStatus, mentionResults, showMoreMentions);
    panel.append(mentions.root, visualPanel);
    renderVisuals();
    const lore = node("div", "sp-review-group");
    lore.append(node("div", "sp-section-label", "The world"));
    for (const item of current.lore) {
      const entry = details(item.name);
      entry.body.append(edit("Entry name", item.name, (v) => {
        item.name = v;
        entry.summary.textContent = v;
      }), edit("Keywords", item.keys.join(", "), (v) => item.keys = v.split(",").map((x) => x.trim()).filter(Boolean)), edit("Lore", item.content, (v) => item.content = v, true, undefined, `lore:${item.id}:content`));
      lore.append(entry.root);
    }
    panel.append(lore);
    const scenes = node("div", "sp-review-group");
    scenes.append(node("div", "sp-section-label", "The set points"), paragraph("Each scene opens a situation. Your next action stays yours.", "sp-hint"));
    current.scenes.forEach((scene, index) => {
      const entry = details(`${String(index + 1).padStart(2, "0")}  ${scene.title}${index === 0 ? " · Opening" : ""}`);
      entry.body.append(edit("Scene title", scene.title, (v) => {
        scene.title = v;
        entry.summary.textContent = `${String(index + 1).padStart(2, "0")}  ${v}`;
      }, false, undefined, `scene:${scene.id}:title`), edit("Scene opening", scene.greeting, (v) => scene.greeting = v, true, undefined, `scene:${scene.id}:greeting`), edit("Private direction", scene.direction, (v) => scene.direction = v, true, "Guides the model toward this scene during play.", `scene:${scene.id}:direction`));
      if (scene.assumptions.length) {
        entry.body.append(node("span", "sp-label", "Assumptions to review"));
        scene.assumptions.forEach((assumption, i) => {
          const note = paragraph(assumption, "sp-notice");
          note.tabIndex = -1;
          reviewFields.set(`scene:${scene.id}:assumption:${i}`, note);
          entry.body.append(note);
        });
      }
      if (scene.sourceRefs.length)
        entry.body.append(paragraph(`Source: ${scene.sourceRefs.join(" · ")}`, "sp-hint"));
      scenes.append(entry.root);
    });
    panel.append(scenes);
    const actions = row(button("Save draft", async () => {
      const requested = clone(current), fingerprint = JSON.stringify(requested);
      const saved = await rpc.request("save-draft", { draft: requested });
      if (nonce === panelNonce && JSON.stringify(current) === fingerprint) {
        draft = saved;
        draftDirty = false;
        draftRevision++;
        draftVersion = JSON.stringify(saved);
        renderReview();
      }
      notify("Draft saved.");
    }), button("Export draft", () => download(`${current.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "set-points"}-draft.json`, current)));
    const create = button("Save to Lumiverse  →", async () => {
      const request = clone(current);
      notify("Saving the narrator and world book to Lumiverse…");
      const result = await rpc.request("create-card", { draft: request }, 120000);
      if (snapshot)
        snapshot.saved = result;
      if (nonce === panelNonce && JSON.stringify(current) === JSON.stringify(request)) {
        draftDirty = false;
        draftRevision++;
        draftVersion = JSON.stringify(current);
      }
      notify(`“${result.title}” is saved. Open it from Characters and start a chat, then return to Play.`);
      renderReview();
    }, true);
    create.classList.add("sp-wide");
    panel.append(actions, create, paragraph("Saves a narrator character card with its world book and ordered scenes. Start a chat with that card to use the scene controls.", "sp-footnote"));
    if (snapshot?.saved?.draftId === current.id) {
      const saved = node("div", "sp-saved sp-stack");
      saved.append(node("h3", "", `Saved: ${snapshot.saved.title}`), paragraph("Open Characters in Lumiverse, select this story, and start a new chat.", "sp-small"), paragraph(`Character: ${snapshot.saved.characterId}`, "sp-inline-code"), paragraph(`World book: ${snapshot.saved.worldBookId}`, "sp-inline-code"));
      panel.append(saved);
    }
  }
  function renderPlay(play) {
    const panel = panels.play;
    panel.replaceChildren();
    panel.append(intro("The story is in your hands", "Follow the thread. Linger in a moment. Or turn the page."));
    if (!play?.chatId || !play.scenes.length) {
      const empty = node("div", "sp-empty");
      empty.append(node("span", "sp-tag", "Ready when you are"), paragraph(play?.notice || "Open a chat with a Set Points story card to see its scenes here."), button("Review your story", () => selectTab("review")));
      panel.append(empty);
      return;
    }
    const chatId = play.chatId;
    async function mutate(action, input = {}) {
      const next = await rpc.request(action, { chatId, ...input });
      if (snapshot)
        snapshot.play = next;
      renderPlay(next);
    }
    const follow = node("div", "sp-card sp-switch");
    const copy = group(node("h3", "", "Follow the story"), paragraph("Guide the narrator toward the next scene. Turn off to explore freely.", "sp-hint"));
    const toggle = node("input");
    toggle.type = "checkbox";
    toggle.checked = play.enabled;
    toggle.setAttribute("aria-label", "Follow the story");
    toggle.setAttribute("role", "switch");
    toggle.disabled = play.busy;
    toggle.addEventListener("change", () => void run(null, async () => {
      toggle.disabled = true;
      try {
        await mutate("play-enable", { enabled: toggle.checked });
      } catch (error) {
        toggle.checked = play.enabled;
        throw error;
      } finally {
        toggle.disabled = false;
      }
    }));
    follow.append(copy, toggle);
    panel.append(follow);
    const current = play.scenes[play.current];
    const currentBox = node("div", "sp-card");
    const track = node("div", "sp-play-track");
    for (let i = 0;i < play.scenes.length; i++) {
      const dash = node("span");
      dash.dataset.done = String(i <= play.current);
      track.append(dash);
    }
    currentBox.append(node("span", "sp-tag", `Current scene · ${Math.max(0, play.current) + 1} / ${play.scenes.length}`), node("h3", "sp-stage-title", current?.title || play.title), track, paragraph(play.title, "sp-hint"));
    panel.append(currentBox);
    const upcoming = node("div", "sp-card sp-stack");
    upcoming.append(node("div", "sp-section-label", "Set the next scene"));
    const pick = node("select");
    pick.setAttribute("aria-label", "Next scene");
    pick.append(option("End of story / no next scene", ""));
    play.scenes.forEach((scene, index) => pick.append(option(`${String(index + 1).padStart(2, "0")} · ${scene.title}`, String(index))));
    pick.value = play.next === null ? "" : String(play.next);
    pick.disabled = play.busy;
    pick.addEventListener("change", () => void run(null, async () => {
      pick.disabled = true;
      try {
        await mutate("play-next", { index: pick.value === "" ? null : Number(pick.value) });
      } finally {
        pick.disabled = false;
      }
    }));
    upcoming.append(pick);
    if (play.next !== null && play.scenes[play.next]) {
      const next = play.scenes[play.next];
      const preview = details("Preview the next scene · contains spoilers");
      preview.body.append(paragraph(next.greeting, "sp-preview"));
      if (next.assumptions.length)
        preview.body.append(paragraph(`Assumptions: ${next.assumptions.join(" ")}`, "sp-notice"));
      upcoming.append(preview.root);
    } else
      upcoming.append(paragraph("You’ve reached the end of the planned scenes. Keep exploring or choose another moment.", "sp-hint"));
    panel.append(upcoming);
    const force = button("Force next scene  →", () => mutate("play-force"), true);
    force.disabled = play.busy || play.next === null;
    force.classList.add("sp-wide");
    const undo = button("Undo last scene insertion", () => mutate("play-undo"));
    undo.disabled = play.busy || !play.canUndo;
    panel.append(force, paragraph("Force inserts the selected scene now, even with story following paused. It does not generate a bridge or choose your character’s response.", "sp-footnote"), undo);
    if (play.notice)
      panel.append(paragraph(play.notice, "sp-notice"));
  }
  async function refresh() {
    if (destroyed)
      return;
    if (refreshInFlight) {
      refreshAgain = true;
      return refreshInFlight;
    }
    refreshInFlight = (async () => {
      try {
        const readRevision = draftRevision;
        const next = await rpc.request("snapshot", ctx.getActiveChat());
        if (destroyed)
          return;
        const completed = snapshot?.job?.status === "running" && next.job?.status === "complete";
        snapshot = next;
        updateConnections(next);
        renderJob(next.job);
        newDraftNotice.hidden = !(pendingReplacement || draftDirty && draft && next.draft && draft.id !== next.draft.id);
        const nextVersion = JSON.stringify(next.draft);
        if (!openingDraft && !draftDirty && readRevision === draftRevision && nextVersion !== draftVersion) {
          draft = next.draft ? clone(next.draft) : null;
          draftVersion = nextVersion;
          renderReview();
        }
        renderVisuals();
        renderPlay(next.play);
        if (completed) {
          notify(newDraftNotice.hidden ? "Your adaptation is ready. Review the cast and scene assumptions before saving." : "Your new adaptation is ready. Your unsaved review edits have been kept.");
          selectTab("review");
        }
      } catch (error) {
        notify(errorText(error), "error");
      } finally {
        refreshInFlight = null;
        if (refreshAgain && !destroyed) {
          refreshAgain = false;
          refresh();
        }
      }
    })();
    return refreshInFlight;
  }
  teardown.push(tab.onActivate(() => {
    refresh();
  }));
  teardown.push(ctx.events.on("CHAT_CHANGED", () => {
    refresh();
  }));
  const openAction = ctx.ui.registerInputBarAction({ id: "set-points-open", label: "Set Points", subtitle: "Review and direct your story", iconSvg: ICON });
  teardown.push(openAction.onClick(() => {
    tab.activate();
    selectTab("play");
  }), () => openAction.destroy());
  const forceAction = ctx.ui.registerInputBarAction({ id: "set-points-force", label: "Force next scene", subtitle: "Set Points · insert the next planned scene", iconSvg: ICON });
  teardown.push(forceAction.onClick(() => void run(null, async () => {
    const active = ctx.getActiveChat();
    if (!active.chatId) {
      tab.activate();
      selectTab("play");
      notify("Open a story chat first.");
      return;
    }
    const play = await rpc.request("play-force", { chatId: active.chatId });
    if (snapshot)
      snapshot.play = play;
    renderPlay(play);
  })), () => forceAction.destroy());
  renderReview();
  renderPlay(null);
  selectTab("import");
  ctx.ready();
  refresh();
  return () => {
    if (destroyed)
      return;
    destroyed = true;
    webAbort?.abort();
    if (polling)
      clearInterval(polling);
    rpc.destroy();
    for (const cleanup of teardown.reverse())
      cleanup();
    app.remove();
    tab.destroy();
  };
}

// dev/fixture.ts
var demoDraft = { version: 1, id: "preview-story", title: "The Lighthouse Letter", premise: "A cartographer arrives in a storm-bound harbor to find her missing brother. A damaged lighthouse, a sealed letter, and a captain’s uneasy promise lead toward the north cove.", playerRole: "Mara, the cartographer", startingPoint: "Mara arrives at Greyhaven harbor", narratorInstructions: "Narrate Greyhaven and its cast through sensory details, restrained tension, and brief dialogue. Mara belongs to the player: leave her thoughts, dialogue, and actions open. Keep Elias’s whereabouts private until the letter is discovered.", cast: [{ id: "iona", name: "Captain Iona", aliases: ["Iona", "Captain"], personality: "Blunt and self-reliant, with a deep respect for promises. She is wary of outsiders but protective of the people of Greyhaven.", voice: "Short, direct sentences. Maritime metaphors used sparingly. Concern shows through practical offers of help.", relationships: "Elias trusts her. Mara is a newcomer; trust must develop through play.", knowledge: "Knows Elias left a sealed letter in the old chart room. Does not know the letter’s contents.", sourceRefs: ["chunk:1"] }, { id: "elias", name: "Elias", aliases: [], personality: "Resourceful and determined, willing to take personal risks to protect the harbor.", voice: "Earnest and practical, with a reassuring sense of humor.", relationships: "Mara’s brother; trusts Captain Iona.", knowledge: "At the opening, his whereabouts and motives are not known to Mara.", sourceRefs: ["chunk:1"] }], lore: [{ id: "greyhaven", name: "Greyhaven", keys: ["Greyhaven", "harbor", "lighthouse"], content: "A small coastal harbor whose safety depends on its lighthouse. A storm is expected at midnight. The old chart room overlooks the docks." }], scenes: [{ id: "harbor", title: "A promise at the harbor", greeting: `The harbor bells ring twice as the wind shifts. Captain Iona stands at the end of the pier, a salt-stained coat drawn tight around her shoulders.

“You’re Elias’s sister.” It sounds less like a question than a decision. “He left something for you. Old chart room.”

Beyond her, the lighthouse remains dark.`, direction: "Introduce Iona’s concern and the approaching storm. Give Mara room to question her or explore.", assumptions: [], sourceRefs: ["chunk:1"] }, { id: "letter", title: "The sealed letter", greeting: `Dust follows the door across the chart room floor. Among the rolled maps lies a small envelope, its wax seal unbroken. Your name is written on the front in Elias’s familiar hand.

Below the window, a boat knocks gently against the seawall.`, direction: "Guide toward access to the chart room without choosing how Mara gets there. The sealed letter can reveal Elias’s mission when Mara chooses to read it.", assumptions: ["Mara has reached the chart room."], sourceRefs: ["chunk:1"] }, { id: "cove", title: "Across the rising tide", greeting: `The north cove opens beneath the cliff. A familiar figure stands beside a grounded boat, one arm wrapped protectively around a cloth-covered case. Elias looks up at the sound of footsteps.

“You found the letter.” Relief gives way to a glance at the water. “The path won’t hold much longer.”`, direction: "Bring the north cove within reach once the letter has been discovered. Let the player decide how to approach or help Elias.", assumptions: ["The letter has been read and the north cove reached."], sourceRefs: ["chunk:1"] }, { id: "beacon", title: "A light through the storm", greeting: `Rain lashes the lighthouse windows. On the worktable, the replacement lens catches a thin glimmer of lantern light. Iona braces the door against the wind.

“Whatever we do,” she says, “we do it soon.”

The dark harbor waits below.`, direction: "Set up the lighthouse repair after the lens returns. Leave the method and outcome open.", assumptions: ["The replacement lens has reached the lighthouse."], sourceRefs: ["chunk:1"] }], warnings: ["Future scenes assume the original route through the story. Review those assumptions if your choices change it."], source: { title: "The Lighthouse Letter", characters: DEMO_STORY.length, chunks: 1 }, createdAt: Date.now() };

// dev/preview.ts
var state = { version: VERSION, permissions: [], connections: [{ id: "preview-model", name: "My writing model", provider: "OpenAI compatible", model: "configured model" }], job: null, draft: null, saved: null, play: { chatId: "preview-chat", characterId: "preview-card", title: "The Lighthouse Letter", enabled: true, current: 0, next: 1, scenes: [], canUndo: false, busy: false, notice: "" }, diagnostics: [] };
var receiver = () => {};
var activate = () => {};
var undoIndex = 0;
var changes = () => receiver({ type: "set-points:changed" });
function load() {
  state.draft = structuredClone(demoDraft);
  state.play.scenes = structuredClone(demoDraft.scenes);
  state.visuals = { job: null, pack: null, sourceSignature: visualDraftSignature(state.draft), resumeAvailable: false, retryUncertain: false };
  changes();
}
function previewVisuals() {
  return { version: 1, draftId: state.draft.id, profiles: state.draft.cast.map((person) => ({ characterId: person.id, description: "Not specified in the source.", appearanceTags: [], startingOutfit: "Not specified in the source.", outfitTags: [], suggestedDetails: person.id === "iona" ? "A weathered blue sailing coat and a small brass compass." : "A practical grey work jacket.", suggestedTags: person.id === "iona" ? ["blue coat", "brass compass"] : ["grey jacket"], unknowns: ["Hair color, eye color, and precise age are not established."], sourceRefs: ["chunk:1"], subject: person.name, countTag: "" })), warnings: ["Preview descriptions are mocked. Suggested details are choices, not facts from the source."] };
}
var root = document.getElementById("root");
var previewPageUrl = (index) => `https://preview.example/lighthouse?page=${index}`;
function fetchPreviewPage(raw) {
  const url = new URL(raw);
  const index = Number(url.searchParams.get("page"));
  if (url.origin !== "https://preview.example" || url.pathname !== "/lighthouse" || !Number.isInteger(index) || index < 1 || index > 3)
    throw new Error("This local preview only loads its three mock pages. Choose Try linked-page preview to fill their address.");
  return { title: `The Lighthouse Letter · page ${index}`, url: previewPageUrl(index), text: demoDraft.scenes[index - 1].greeting, nextPages: index < 3 ? [{ title: "Next page", url: previewPageUrl(index + 1) }] : [] };
}
var ctx = { ui: { registerDrawerTab: () => ({ root, tabId: "preview", setBadge: () => {}, activate: () => activate(), setTitle: () => {}, setShortName: () => {}, destroy: () => {}, onActivate: (callback) => {
  activate = callback;
  return () => {};
} }), registerInputBarAction: () => ({ onClick: () => () => {}, destroy: () => {}, setLabel: () => {}, setSubtitle: () => {}, setEnabled: () => {} }) }, dom: { addStyle: (css) => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
} }, events: { on: () => () => {} }, getActiveChat: () => ({ chatId: "preview-chat", characterId: "preview-card" }), ready: () => {}, onBackendMessage: (handler) => {
  receiver = handler;
  return () => {};
}, sendToBackend: (request) => {
  setTimeout(() => {
    let result;
    try {
      switch (request.action) {
        case "snapshot":
          result = structuredClone(state);
          break;
        case "fetch-url":
          result = fetchPreviewPage(request.input.url);
          break;
        case "test-connection":
          result = { message: "Preview: the provider accepted the neutral test request." };
          break;
        case "resume-import":
        case "start-import":
          state.resume = { available: false, retryUncertain: false };
          state.job = { id: "preview-job", status: "running", completed: 0, total: 2, label: "Reading characters and setting…" };
          result = structuredClone(state.job);
          setTimeout(() => {
            if (state.job?.status !== "running")
              return;
            load();
            state.job = { id: "preview-job", status: "complete", completed: 2, total: 2, label: "Your adaptation is ready." };
            changes();
          }, 1800);
          break;
        case "start-visuals": {
          const signature = visualDraftSignature(request.input.draft);
          state.visuals = { ...state.visuals, job: { id: "preview-visual-job", status: "running", completed: 0, total: 2, label: "Reading source appearance facts…" }, pack: state.visuals?.pack ?? null, requestSignature: signature, sourceSignature: signature, resumeAvailable: false, retryUncertain: false, connectionId: request.input.connectionId, maxOutputTokens: request.input.maxOutputTokens, reasoningMode: request.input.reasoningMode };
          result = structuredClone(state.visuals.job);
          setTimeout(() => {
            if (state.visuals?.job?.status !== "running")
              return;
            state.visuals.pack = previewVisuals();
            state.visuals.resultSignature = signature;
            state.visuals.job = { ...state.visuals.job, status: "complete", completed: 2, label: "Image descriptions ready." };
            changes();
          }, 1600);
          break;
        }
        case "cancel-visuals":
          if (state.visuals?.job) {
            state.visuals.job.status = "cancelled";
            state.visuals.job.label = "Descriptions cancelled";
            state.visuals.resumeAvailable = true;
          }
          break;
        case "resume-visuals":
          if (state.visuals) {
            state.visuals.pack = previewVisuals();
            state.visuals.resultSignature = state.visuals.requestSignature;
            state.visuals.resumeAvailable = false;
            state.visuals.job = { id: "preview-visual-job", status: "complete", completed: 2, total: 2, label: "Image descriptions ready." };
          }
          break;
        case "save-visuals":
          if (state.visuals) {
            state.visuals.pack = structuredClone(request.input.pack);
            state.visuals.resultSignature = visualDraftSignature(request.input.draft);
            result = state.visuals.pack;
          }
          break;
        case "cancel-import":
          if (state.job) {
            state.job.status = "cancelled";
            state.resume = { available: true, retryUncertain: false };
          }
          break;
        case "save-draft":
          state.draft = structuredClone(request.input.draft);
          result = state.draft;
          break;
        case "create-card":
          state.saved = { characterId: "preview-character-id", worldBookId: "preview-worldbook-id", draftId: request.input.draft.id, title: request.input.draft.title };
          state.play.scenes = structuredClone(request.input.draft.scenes);
          result = state.saved;
          break;
        case "play-enable":
          state.play.enabled = request.input.enabled;
          result = state.play;
          break;
        case "play-next":
          state.play.next = request.input.index;
          result = state.play;
          break;
        case "play-force":
          if (state.play.next === null)
            throw new Error("There is no next scene.");
          undoIndex = state.play.current;
          state.play.current = state.play.next;
          state.play.next = state.play.current + 1 < state.play.scenes.length ? state.play.current + 1 : null;
          state.play.canUndo = true;
          state.play.notice = "Preview: the selected scene was inserted.";
          result = state.play;
          break;
        case "play-undo":
          state.play.next = state.play.current;
          state.play.current = undoIndex;
          state.play.canUndo = false;
          state.play.notice = "Preview: the last insertion was undone.";
          result = state.play;
          break;
        case "diagnostics":
          result = { version: VERSION, preview: true, storyTextIncluded: false };
          break;
        default:
          throw new Error("Unknown preview action");
      }
      receiver({ type: "set-points:response", id: request.id, result: structuredClone(result) });
    } catch (error) {
      receiver({ type: "set-points:response", id: request.id, error: String(error) });
    }
  }, request.action === "fetch-url" ? 650 : 100);
} };
setup(ctx);
document.getElementById("demo").onclick = () => {
  load();
  setTimeout(() => root.querySelector('[role="tab"][aria-controls$="-review"]')?.click(), 150);
};
document.getElementById("theme").onclick = () => document.body.classList.toggle("light");
var linkedPreview = document.createElement("button");
linkedPreview.textContent = "Try linked-page preview";
document.getElementById("demo").after(linkedPreview);
linkedPreview.onclick = () => {
  root.querySelector('[role="tab"][aria-controls$="-import"]')?.click();
  const label = Array.from(root.querySelectorAll("label")).find((item) => item.textContent === "Story link");
  const input = label ? root.querySelector(`#${label.htmlFor}`) : null;
  if (input) {
    input.value = previewPageUrl(1);
    input.closest("details").open = true;
    input.focus();
    input.scrollIntoView({ block: "center", behavior: "smooth" });
  }
};
