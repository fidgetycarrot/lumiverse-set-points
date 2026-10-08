// src/types.ts
var VERSION = "0.1.0";
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
.sp-header{display:flex;align-items:center;gap:15px;margin-bottom:28px}.sp-mark{flex:none;width:44px;height:54px;position:relative;border-left:1px solid var(--sp-accent);transform:skewY(-18deg);margin:0 1px 0 12px}.sp-mark:before,.sp-mark:after{content:"";width:13px;height:13px;border:2px solid var(--sp-accent);border-radius:50%;position:absolute;background:var(--sp-bg);left:-7px}.sp-mark:before{top:0}.sp-mark:after{bottom:0;background:var(--sp-accent)}.sp-mark span{position:absolute;left:0;top:26px;width:35px;border-top:1px solid var(--sp-accent)}.sp-eyebrow{font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:var(--sp-accent);margin-bottom:6px!important}.sp-subtitle{font-size:12px;color:var(--sp-muted);margin-top:6px!important}.sp-tabs{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--sp-line);gap:8px;margin-bottom:24px}.sp-tab{background:none;border:0;color:var(--sp-muted);padding:11px 4px 14px;border-bottom:2px solid transparent;margin-bottom:-1px;text-align:left;font-size:13px!important}.sp-tab[aria-selected=true]{border-color:var(--sp-accent);color:var(--sp-ink)}.sp-tab small{color:var(--sp-accent);margin-right:7px;font-size:10px;letter-spacing:1px}.sp-intro{display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:20px}.sp-muted{color:var(--sp-muted)}.sp-small{font-size:12px}.sp-intro p{margin-top:7px}.sp-panel{display:flex;flex-direction:column;gap:18px}.sp-card{border:1px solid var(--sp-line);border-radius:var(--sp-radius);padding:18px;background:var(--sp-card)}.sp-card>h3{margin-bottom:12px}.sp-stack{display:flex;flex-direction:column;gap:14px}.sp-field{display:flex;flex-direction:column;gap:6px}.sp-label{font-size:12px;font-weight:650;letter-spacing:.2px}.sp-hint{font-size:11px;line-height:1.5;color:var(--sp-muted)}.sp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.sp-row.sp-spread{justify-content:space-between}.sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sp-button{border:1px solid var(--sp-line);border-radius:8px;background:transparent;color:var(--sp-ink);padding:9px 13px;font-weight:600;font-size:12px!important;line-height:1.4;display:inline-flex;justify-content:center;align-items:center;gap:8px;white-space:normal}.sp-button:hover:not(:disabled){background:color-mix(in srgb,var(--sp-ink) 7%,transparent)}.sp-button.sp-primary{background:var(--sp-accent);color:var(--sp-accent-ink);border-color:var(--sp-accent)}.sp-button.sp-primary:hover:not(:disabled){filter:brightness(1.07)}.sp-button.sp-text{border:0;color:var(--sp-accent);padding:3px 0;font-weight:500}.sp-button.sp-wide{width:100%;padding:13px}.sp-source{min-height:245px!important;line-height:1.65!important;font:14px/1.7 Georgia,"Times New Roman",serif!important}.sp-separator{height:1px;background:var(--sp-line);margin:2px 0}.sp-details{border:1px solid var(--sp-line);border-radius:10px;background:var(--sp-card);padding:0 15px}.sp-details>summary{cursor:pointer;font-weight:600;font-size:12px;padding:14px 0;list-style-position:inside}.sp-details[open]>summary{border-bottom:1px solid var(--sp-line);margin-bottom:15px}.sp-details>.sp-stack{padding-bottom:16px}.sp-details .sp-hint{font-weight:400}.sp-status{font-size:12px;line-height:1.5;padding:11px 13px;background:color-mix(in srgb,var(--sp-accent) 9%,var(--sp-bg));border:1px solid color-mix(in srgb,var(--sp-accent) 24%,transparent);border-radius:8px;margin-bottom:17px}.sp-status[data-kind=error]{border-color:#c6786c;color:#efa99e;background:color-mix(in srgb,#c6786c 8%,var(--sp-bg))}.sp-status:empty{display:none}.sp-progress{display:flex;flex-direction:column;gap:9px;border:1px solid var(--sp-line);padding:16px;border-radius:10px}.sp-progress progress{width:100%;height:6px;accent-color:var(--sp-accent);border:0}.sp-empty{padding:32px 22px;border:1px dashed var(--sp-line);border-radius:12px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}.sp-empty p{max-width:320px}.sp-tag{display:inline-block;padding:4px 8px;border-radius:5px;background:color-mix(in srgb,var(--sp-accent) 10%,transparent);color:var(--sp-accent);font-size:10px;font-weight:650;letter-spacing:1px;text-transform:uppercase}.sp-counts{display:flex;gap:20px;border-top:1px solid var(--sp-line);border-bottom:1px solid var(--sp-line);padding:13px 0;margin-top:17px}.sp-counts strong{display:block;font:normal 24px Georgia,serif;color:var(--sp-ink)}.sp-counts span{font-size:11px;color:var(--sp-muted)}.sp-section-label{font-size:10px;text-transform:uppercase;letter-spacing:1.6px;color:var(--sp-muted);font-weight:700;padding-top:4px}.sp-review-group{display:flex;flex-direction:column;gap:9px}.sp-scene-num{font-variant-numeric:tabular-nums;color:var(--sp-accent);font-size:11px;margin-right:8px}.sp-notice{border-left:2px solid var(--sp-accent);padding:3px 0 3px 13px;font-size:12px;color:var(--sp-muted)}.sp-footnote{font-size:11px;color:var(--sp-muted);line-height:1.6}.sp-footer{margin-top:30px;padding-top:16px;border-top:1px solid var(--sp-line);display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--sp-muted);font-size:10px;letter-spacing:.4px}.sp-footer button{font-size:10px!important}.sp-preview{white-space:pre-wrap;font:15px/1.8 Georgia,"Times New Roman",serif;max-height:280px;overflow:auto;padding-right:4px}.sp-stage-title{font:normal 25px/1.3 Georgia,serif;margin-top:9px!important;margin-bottom:12px!important}.sp-switch{display:flex;align-items:center;justify-content:space-between;gap:20px}.sp-switch input{width:36px;height:20px;accent-color:var(--sp-accent);flex:none}.sp-play-track{display:flex;gap:5px;margin:17px 0 7px}.sp-play-track span{height:3px;flex:1;border-radius:2px;background:var(--sp-line)}.sp-play-track span[data-done=true]{background:var(--sp-accent)}.sp-saved{border:1px solid color-mix(in srgb,var(--sp-accent) 40%,transparent);border-radius:10px;padding:15px;background:color-mix(in srgb,var(--sp-accent) 5%,transparent)}.sp-saved code{font-size:10px;word-break:break-all}.sp-inline-code{font:11px/1.6 ui-monospace,monospace;white-space:pre-wrap}.sp-app .sp-no-margin{margin:0}
@media(prefers-color-scheme:light){.sp-app{--sp-bg:var(--lumiverse-bg,#faf8f3);--sp-card:var(--lumiverse-bg-secondary,#fffdf8);--sp-ink:var(--lumiverse-text,#28251f);--sp-muted:var(--lumiverse-text-muted,#746e62);--sp-accent:#996219;--sp-accent-ink:#fff9ed;color-scheme:light}.sp-status[data-kind=error]{color:#a43f33}}
@container(max-width:380px){.sp-grid{grid-template-columns:1fr}.sp-intro{flex-wrap:wrap}.sp-counts{gap:14px}.sp-header{gap:10px}.sp-app h1{font-size:33px}.sp-tab small{margin-right:4px}.sp-button{padding:9px 10px}}
`;

// src/frontend.ts
var MAX_SOURCE = 500000;
var MAX_DRAFT = 192000;
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
      if (control && !destroyed)
        control.disabled = control === importButton && snapshot?.job?.status === "running";
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
  function intro(title, copy) {
    const value = node("div", "sp-intro");
    const text = node("div");
    text.append(node("h2", "", title), paragraph(copy));
    value.append(text);
    return value;
  }
  function download(name, value) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const anchor = node("a");
    anchor.href = url;
    anchor.download = name;
    app.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  newDraftNotice.append(paragraph("A new adaptation is ready. Loading it replaces your unsaved review edits.", "sp-small"), button("Load new draft", () => {
    if (!snapshot?.draft)
      return;
    draft = clone(snapshot.draft);
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
    source.input.value = text;
    title.input.value = file.name.replace(/\.(txt|md)$/i, "");
    url.input.value = "";
    updateSourceCount();
    fileInput.value = "";
    notify("Text loaded. Review it below before adapting.");
  }));
  const sourceTools = row(button("Open text file", () => fileInput.click()), button("Try a sample", () => {
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
  const fetchButton = button("Read page", async () => {
    const parsed = new URL(url.input.value);
    if (!["http:", "https:"].includes(parsed.protocol))
      throw new Error("Use an http or https story link.");
    const result = await rpc.request("fetch-url", { url: parsed.href });
    if (result.text.length > MAX_SOURCE)
      throw new Error("This page is too long. Paste a smaller section instead.");
    source.input.value = result.text;
    title.input.value = result.title;
    url.input.value = result.url;
    updateSourceCount();
    notify("Page loaded. Check that the story text is complete before adapting.");
  });
  linkSection.body.append(paragraph("Some sites block page access. Pasting text always works.", "sp-hint"), url.wrap, fetchButton);
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
  const optionGrid = node("div", "sp-grid");
  optionGrid.append(sceneCount.wrap, connectionWrap);
  options.append(role.wrap, start.wrap, optionGrid);
  panels.import.append(options);
  const advanced = details("Long-story settings");
  const chunk = field("Characters per section", "12000", undefined, { type: "number", min: 4000, max: 20000, hint: "Long stories are read in sections, then reconciled into one adaptation. Use a smaller section for models with less context." });
  advanced.body.append(chunk.wrap);
  panels.import.append(advanced.root);
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
  progressBox.append(progressText, progress, cancel);
  panels.import.append(progressBox);
  const importButton = button("Create adaptation  →", async () => {
    if (!source.input.value.trim())
      throw new Error("Add story text before creating an adaptation.");
    if (!connection.value)
      throw new Error("Choose an adaptation connection. Add one in Lumiverse settings if the list is empty.");
    const sceneNumber = Number(sceneCount.input.value), chunkNumber = Number(chunk.input.value);
    if (!Number.isInteger(sceneNumber) || sceneNumber < 2 || sceneNumber > 24)
      throw new Error("Choose between 2 and 24 scenes.");
    if (!Number.isInteger(chunkNumber) || chunkNumber < 4000 || chunkNumber > 20000)
      throw new Error("Section size must be between 4,000 and 20,000 characters.");
    const options = { text: source.input.value, sourceTitle: title.input.value.trim(), sourceUrl: url.input.value.trim() || undefined, playerRole: role.input.value.trim(), startingPoint: start.input.value.trim(), sceneCount: sceneNumber, connectionId: connection.value, chunkSize: chunkNumber };
    const job = await rpc.request("start-import", { options });
    if (snapshot)
      snapshot.job = job;
    renderJob(job);
    notify("Your story is being adapted. You can leave this panel open or return later.");
    await refresh();
  }, true);
  importButton.classList.add("sp-wide");
  panels.import.append(importButton, paragraph("Creates a draft for you to review. Each section and the final adaptation use your connected model and its normal charges.", "sp-footnote"));
  function updateSourceCount() {
    count.textContent = `${source.input.value.length.toLocaleString()} characters`;
  }
  function renderJob(job) {
    const running = job?.status === "running";
    progressBox.hidden = !job;
    importButton.disabled = !!running;
    cancel.hidden = !running;
    if (job) {
      progressText.textContent = job.error || job.label;
      progress.max = Math.max(1, job.total);
      progress.value = Math.min(job.completed, progress.max);
    }
    if (running && !polling)
      polling = setInterval(() => {
        refresh();
      }, 2500);
    if (!running && polling) {
      clearInterval(polling);
      polling = undefined;
    }
    tab.setBadge(running ? "…" : null);
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
  const draftFileInput = node("input");
  draftFileInput.type = "file";
  draftFileInput.accept = ".json,application/json";
  draftFileInput.hidden = true;
  draftFileInput.setAttribute("aria-label", "Open saved Set Points draft");
  app.append(draftFileInput);
  const openDraftButton = button("Open draft", () => draftFileInput.click());
  draftFileInput.addEventListener("change", () => void run(openDraftButton, async () => {
    const file = draftFileInput.files?.[0];
    if (!file)
      return;
    openingDraft = true;
    try {
      if (!/\.json$/i.test(file.name))
        throw new Error("Choose a Set Points draft saved as a .json file.");
      if (file.size > MAX_DRAFT * 4)
        throw new Error("This draft file is too large. Open a draft with up to 192,000 characters.");
      const text = await file.text();
      if (text.length > MAX_DRAFT)
        throw new Error("This draft file is too large. Open a draft with up to 192,000 characters.");
      let imported;
      try {
        imported = JSON.parse(text);
      } catch {
        throw new Error("This file could not be read. Choose a Set Points draft exported from Review.");
      }
      notify("Checking the saved draft…");
      const restored = await rpc.request("save-draft", { draft: imported });
      if (destroyed)
        return;
      draft = clone(restored);
      draftDirty = false;
      draftRevision++;
      draftVersion = JSON.stringify(restored);
      if (snapshot)
        snapshot.draft = clone(restored);
      newDraftNotice.hidden = true;
      renderReview();
      selectTab("review");
      notify("Draft opened and saved. Review it before saving the character card.");
    } finally {
      openingDraft = false;
      draftFileInput.value = "";
    }
  }));
  function renderReview() {
    const panel = panels.review;
    panel.replaceChildren();
    panelNonce++;
    if (!draft) {
      const top = intro("Meet your adaptation", "A little preparation makes room for a better story.");
      top.append(openDraftButton);
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
    top.append(group(dirtyTag, openDraftButton));
    panel.append(top);
    const markDirty = () => {
      draftDirty = true;
      dirtyTag.textContent = "Unsaved edits";
    };
    const edit = (label, value, change, area = false, hint) => field(label, value, (v) => {
      change(v);
      markDirty();
    }, { area, hint }).wrap;
    const summary = node("div", "sp-card sp-stack");
    summary.append(edit("Title", current.title, (v) => current.title = v), edit("Premise", current.premise, (v) => current.premise = v, true));
    const choices = node("div", "sp-grid");
    choices.append(edit("Your role", current.playerRole, (v) => current.playerRole = v), edit("Starting point", current.startingPoint, (v) => current.startingPoint = v));
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
    narration.body.append(edit("Instructions", current.narratorInstructions, (v) => current.narratorInstructions = v, true, "Describe the narrator’s scope and how it should leave your choices open."));
    panel.append(narration.root);
    const cast = node("div", "sp-review-group");
    cast.append(node("div", "sp-section-label", "The people"));
    for (const person of current.cast) {
      const entry = details(person.name);
      entry.body.append(edit("Name", person.name, (v) => {
        person.name = v;
        entry.summary.textContent = v;
      }), edit("Also known as", person.aliases.join(", "), (v) => person.aliases = v.split(",").map((x) => x.trim()).filter(Boolean)), edit("Personality", person.personality, (v) => person.personality = v, true), edit("Voice & manner", person.voice, (v) => person.voice = v, true), edit("Relationships at the start", person.relationships, (v) => person.relationships = v, true), edit("Knowledge at the start", person.knowledge, (v) => person.knowledge = v, true));
      if (person.sourceRefs.length)
        entry.body.append(paragraph(`Source: ${person.sourceRefs.join(" · ")}`, "sp-hint"));
      cast.append(entry.root);
    }
    panel.append(cast);
    const lore = node("div", "sp-review-group");
    lore.append(node("div", "sp-section-label", "The world"));
    for (const item of current.lore) {
      const entry = details(item.name);
      entry.body.append(edit("Entry name", item.name, (v) => {
        item.name = v;
        entry.summary.textContent = v;
      }), edit("Keywords", item.keys.join(", "), (v) => item.keys = v.split(",").map((x) => x.trim()).filter(Boolean)), edit("Lore", item.content, (v) => item.content = v, true));
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
      }), edit("Scene opening", scene.greeting, (v) => scene.greeting = v, true), edit("Private direction", scene.direction, (v) => scene.direction = v, true, "Guides the model toward this scene during play."));
      if (scene.assumptions.length) {
        entry.body.append(node("span", "sp-label", "Assumptions to review"));
        for (const assumption of scene.assumptions)
          entry.body.append(paragraph(assumption, "sp-notice"));
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
        newDraftNotice.hidden = !(draftDirty && draft && next.draft && draft.id !== next.draft.id);
        const nextVersion = JSON.stringify(next.draft);
        if (!openingDraft && !draftDirty && readRevision === draftRevision && nextVersion !== draftVersion) {
          draft = next.draft ? clone(next.draft) : null;
          draftVersion = nextVersion;
          renderReview();
        }
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
var state = { version: "0.1.0", permissions: [], connections: [{ id: "preview-model", name: "My writing model", provider: "OpenAI compatible", model: "configured model" }], job: null, draft: null, saved: null, play: { chatId: "preview-chat", characterId: "preview-card", title: "The Lighthouse Letter", enabled: true, current: 0, next: 1, scenes: [], canUndo: false, busy: false, notice: "" }, diagnostics: [] };
var receiver = () => {};
var activate = () => {};
var undoIndex = 0;
var changes = () => receiver({ type: "set-points:changed" });
function load() {
  state.draft = structuredClone(demoDraft);
  state.play.scenes = structuredClone(demoDraft.scenes);
  changes();
}
var root = document.getElementById("root");
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
          throw new Error("Link extraction is unavailable in this local preview. Use the sample or paste a story.");
        case "start-import":
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
        case "cancel-import":
          if (state.job)
            state.job.status = "cancelled";
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
          result = { version: "0.1.0", preview: true, storyTextIncluded: false };
          break;
        default:
          throw new Error("Unknown preview action");
      }
      receiver({ type: "set-points:response", id: request.id, result: structuredClone(result) });
    } catch (error) {
      receiver({ type: "set-points:response", id: request.id, error: String(error) });
    }
  }, 100);
} };
setup(ctx);
document.getElementById("demo").onclick = () => {
  load();
  setTimeout(() => root.querySelector('[role="tab"][aria-controls$="-review"]')?.click(), 150);
};
document.getElementById("theme").onclick = () => document.body.classList.toggle("light");
