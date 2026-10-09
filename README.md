# Set Points

**A story. Your choices.**

Set Points adapts story text into a playable Lumiverse narrator card, supporting cast, world book, and a sequence of scenes. Review the adaptation, choose your role, and decide whether to follow the source or explore freely.

Version **0.1.7** fixes image-description failures caused by nested or object-shaped supporting references while preserving saved responses for Resume. The optional description step can now read linked website pages directly. **Check for conflicting looks** shows short excerpts with an **Open location** button instead of whole passages. You can still edit an **Appearance guide** on any existing draft without a model request or reimport; approved details are saved in the draft and published card and world book. Optional analysis uses normal text-model charges and does not generate images. Live provider verification remains outstanding.

## What it does

- Accepts pasted text and `.txt` / `.md` files. Link import can collect a sequence of readable story pages for you to inspect before adaptation.
- Lets you choose a model connection, player role, starting point, and desired scene count. **Check connection** can test that selection with a small neutral request before sending your story.
- Reads long sources in sections, merges character identities and chronology, then creates an editable adaptation. Saves model responses before format and size validation so completed matching requests can be reused after an interruption or validation failure.
- Produces a narrator card, attached world book, initial greeting, and ordered alternate greetings.
- Lets you approve appearance and starting-outfit details directly in Review, including on existing 0.1.5 drafts. Publishes those details as a shared reference in the narrator card and an always-on world-book entry.
- Optionally creates separate character image descriptions with source facts, starting outfits, unknowns, and clearly labeled suggestions. Provides appearance/outfit tag copy buttons, combined Anima tags, captions, and a separate JSON export.
- Includes its own scene controls: **Follow the story**, **Choose next scene**, **Force next scene**, and **Undo last scene insertion**.
- Keeps independent progression in each chat, with recovery after interrupted writes and protection against duplicate handoffs.
- Exports and reopens draft JSON. Diagnostic exports exclude story prose, character names, source URLs, and provider credentials.

Set Points is self-contained. Waypoints is not required. If you also use Waypoints, disable its progression in chats controlled by Set Points so two controllers do not compete.

## Installation

Requires **Lumiverse 1.2.0 or newer**. The source uses `lumiverse-spindle-types` 0.6.40, with compatibility handling for the lifecycle events supplied by Lumiverse 1.2.0.

This package includes prebuilt `dist/backend.js` and `dist/frontend.js`; users do not need to build them.

Repository installation URL: [fidgetycarrot/lumiverse-set-points](https://github.com/fidgetycarrot/lumiverse-set-points).

1. Open Lumiverse's **Extensions** panel and choose its repository installation option.
2. Paste `https://github.com/fidgetycarrot/lumiverse-set-points` and install.
3. Enable **Set Points**, grant its requested permissions, and open the **Set Points** drawer tab. Web-page access is optional; pasted text works without it.

**Updating after a failed 0.1.3 or 0.1.4 import:** update the existing extension in place and choose **Resume saved import**. Keep its private storage intact; do not uninstall the extension or clear its stored data before resuming.

| Permission | Used for |
| --- | --- |
| `generation` | Adaptation and optional image-description requests, connection choices, and generation lifecycle tracking |
| `characters` | Creating narrator cards and reading their scene data |
| `world_books` | Creating and attaching starting cast and lore |
| `chats` | Finding and validating the selected chat |
| `chat_mutation` | Inserting, cleaning, and undoing scene messages |
| `interceptor` | Adding current/next scene direction before a normal reply |
| `cors_proxy` | Optional web-page extraction; pasted text works without it |

The declared `base64_decode` backend capability is needed by a bundled DOM-parser fallback. Set Points does not evaluate imported source code or request dynamic-code-execution capability.

## First story

1. In **Import**, paste a story, open a text file, or choose **Try a sample**. For a multi-page story, open **Import from a link**, enter the first page, and choose **Read linked pages**. Review the collected pages, then choose **Use collected text**. **Read page** loads just the selected page.
2. Enter the story title, who you will play, and where play begins. Choose an adaptation connection with a model configured in Lumiverse. Set Points sends that connection’s provider and model with each adaptation request. The role may be an existing character or a new one. If you need to test the connection first, choose **Check connection**; this sends a small neutral request without your story and uses normal provider charges.
3. Choose **Create adaptation**. New section-reading, merge, plan, cast/lore batch, scene batch, and format-repair requests use that connection and normal provider charges. Matching saved requests are reused. You can cancel while keeping your previous completed draft; **Resume saved import** uses the source and settings saved for the last attempt.
4. In **Review**, edit the premise, cast, approved appearances, starting knowledge, world lore, narrator instructions, and scenes. Check adaptation notes and each scene's continuity assumptions. Export the draft if you want a backup.
5. Choose **Save to Lumiverse**. Set Points creates one narrator card and attaches its world book. It does not activate the world book globally or overwrite existing cards. Repeating the identical save recovers the existing card rather than duplicating it.
6. Open the new character from Lumiverse's **Characters** browser and start a chat with its initial greeting. Return to Set Points' **Play** tab.

The examples folder includes a short original sample story and a validated sample draft. Use **Open draft** in Review to try saving a card without making an adaptation-model request.

## Approved appearances for the story

In **Review → The people**, each character has **approved appearance** and **approved starting outfit** fields. Enter your chosen details directly, then **Save draft**. These fields are available on existing 0.1.5 drafts immediately; editing and saving them require neither the original source nor a model request. Blank fields remain unspecified.

Approved details are part of the story-draft JSON. **Save to Lumiverse** includes the same guide in the narrator card and a dedicated always-on **Approved character appearances** world-book entry. The narrator is instructed to prefer approved details over conflicting incidental descriptions, preserve physical traits until you explicitly approve a change, and keep the starting outfit until an explicit action changes it. Existing cast and lore entries are preserved. The model can still make mistakes; this guidance is not a consistency guarantee.

Use **Check for conflicting looks · optional → Scan appearance mentions** when you want to compare existing prose with your approved look. It shows short excerpts, eight at a time, with their locations. **Open location** opens and focuses the corresponding editor; **Show more excerpts** reveals the next batch. You do not need to read whole passages. These are possible mentions, not confirmed conflicts: a glance or an outfit changing during the story can be harmless. This local keyword search costs nothing, makes no edits, and is not exhaustive. Saved scene openings, including **Force next scene** insertions, are literal text and are not automatically rewritten to match approved appearances.

After using optional Image descriptions, **Use these appearances in story** copies only the displayed source appearance and starting-outfit prose into the approved fields. Review the result before saving: it replaces those approved fields for the listed characters, leaves unspecified facts blank, and excludes suggested details and tags. You can manually approve a suggested design choice by entering it in the approved fields. Generating or saving a separate description pack alone does not approve it for the story.

**Copy [character] approved caption** copies only the approved appearance and outfit. When those fields differ from the matching source-analysis prose, a notice warns that its separate tag and caption buttons still use the source-analysis version. Free-text edits are not automatically converted into image tags. Use the approved caption, or deliberately update the relevant image-description fields before copying their prompts.

Publishing an edited appearance guide creates a new card and attached world book under the existing save behavior; it does not update a previously published card or an ongoing chat. Repeating an unchanged save reuses its existing card.

## Optional image descriptions

After a draft is ready, open **Review → Image descriptions · optional**. Choose the description connection and click **Create image descriptions** only when you want this additional step. Set Points reads the original story again in sections, then creates profiles for the draft’s cast. Each new source-reading, profile, or format-repair request uses normal text-model charges. Generation alone does not change the approved story appearances, published card, or world book. Nothing is sent to Lumi Studio automatically.

Newly completed drafts retain a verified link to their original source. Existing 0.1.5 drafts, opened drafts, or relevant edits to a draft may need the original text once. Open **Read the original story from a website**, enter its first-page URL, and choose **Read linked story pages**. The saved source URL is prefilled when available. Check the page count and stopping message, then choose **Use website text for descriptions** to place the collected text in the source field for review. The same multi-page collector and limits apply as in Import; loading pages makes no model request and preserves your completed adaptation. Optional **Other description page links** accepts additional URLs in reading order when automatic navigation is unclear. Pasting into **Original story for these descriptions** or choosing **Use story text from Import** also remains available.

Use **Use different story text** to correct an already matched source; review the replacement before deliberately creating descriptions again. The extension never assumes the latest Import text belongs to the current draft. The source, description result, and resumable request are checked against the draft fields used for appearance analysis; descriptions for a different draft version are hidden instead of replacing edits. Once a description attempt has saved its source, **Resume saved descriptions** uses that source without another paste or website fetch.

Each character has editable **appearance from the story**, **starting outfit from the story**, corresponding tags, and a caption subject. Source references and unknown traits help you review the evidence. Later or uncertain appearance changes are kept out of starting defaults. **Suggested details** and suggested tags are separate from source facts. They are excluded from combined copied prompts by default; explicitly check **Include suggested details in copied prompts** to include them. Model extraction can still be mistaken, so review the facts and suggestions before using them.

For [Lumi Studio](https://github.com/fidgetycarrot/lumidraw-studio), use **Copy [character] appearance tags** for its Appearance field and **Copy [character] outfit tags** for its Outfit field. These two buttons always copy their respective canonical tag lists, without the prose descriptions or suggestions. Appearance and suggested lists support up to 32 tags each; starting-outfit tags are limited to 12 for Lumi Studio’s Outfit field. Detailed outfit prose remains separate. The separate appearance/outfit prose buttons are available for other uses. **Copy [character] Anima tags** combines the selected subject-count tag, appearance tags, and outfit tags; **Copy [character] caption** copies their natural-language description. Clipboard access can depend on the host; when unavailable, Set Points selects the text for manual copying.

Anima supports tags, natural-language captions, and combinations. Its documentation calls for lowercase tags with spaces rather than underscores. Set Points supplies character traits and leaves model, quality, style, rating, and other preset choices to your image tool. See the [official Anima prompting guide](https://huggingface.co/circlestone-labs/Anima/blob/main/README.md).

**Save descriptions** stores this separate description pack. **Export descriptions** prepares its JSON backup and requests a download. Story-draft exports include approved appearance prose, but do not include the separate pack or its unapproved suggestions. Description generation, copying, and editing do not synchronize Lumi Studio fields. Main story edits remain available during generation, and new results cannot overwrite unsaved description edits without choosing **Load new descriptions**.

**Cancel descriptions** retains completed saved work. **Resume saved descriptions** uses the saved description draft, source, and connection, with the selected description response settings applying to unfinished requests. It is offered only for a matching draft version. Completed compatible responses are reused; remaining requests incur normal charges. If a previous request’s outcome is unknown, **Retry unfinished description request** explicitly warns that it may already have been charged and that retrying can charge it again. Keep extension storage intact for recovery.

## Backing up and reopening a draft

**Export draft** shows the complete **JSON backup** and its filename while requesting a download. The backup remains visible even if the host blocks downloading. **Download JSON** retries the download; **Copy backup** copies the text, or selects it for manual copying if clipboard access is unavailable. You can paste the complete text into a plain-text editor and save it using the shown `.json` filename. A “Download requested” message does not confirm that a file was saved.

Restore a story draft with **Open draft**, or choose **Paste draft backup**, paste the complete JSON, and select **Open pasted draft**. A valid backup is saved and opened after validation; invalid backups preserve the current draft. If you edit Review while validation is pending, those newer edits remain visible and **Load new draft** lets you choose when to replace them. Reopening a draft does not run the model. Description-pack and diagnostic exports use the same visible backup controls, but they are not story-draft files and cannot be opened as a draft.

## Multi-page web stories

**Read linked pages** follows one clear next-page link at a time, on the same website, starting at the URL you enter. It checks navigation before extracting story text, including Literotica’s numbered story-page links. It does not automatically collect a separate series or guess chapter URLs. If a story starts on an earlier page, enter that first-page URL.

For sites with unclear links, put additional page URLs in **Other page links**, one per line in reading order. These form an explicit list after the first page; automatic discovery is not used for that list. Every retry starts again from the first URL, so include every subsequent page, including any already collected. All pages must share the same website origin.

Collection is limited to **100 pages** and **500,000 combined characters**, including page separators. It stops on ambiguous links, repeated URLs or text, a failed page, cancellation, or a size limit. The collected-page list and stopping message let you see what was loaded; the absence of a next-page link does not prove the story is complete.

Your current story text and title remain in place while pages load. Review the collected pages and choose **Use collected text** to replace them. If collection stops partway, you can keep the pages collected so far or correct the links and try again. Loading pages does not call your adaptation model. You choose **Create adaptation** separately.

## Scene controls

**Follow the story** is off in new chats. Turn it on to add private direction for the current scene and selected next scene. The model is asked to bring the situation to the next scene's doorstep while leaving the player's speech, thoughts, choices, and actions to them. When a normal completed reply includes the one-use handoff signal, Set Points removes it from the saved reply and appends the selected scene opening.

**Force next scene** immediately inserts the selected opening, including when following is paused. It does not generate a bridge or choose what the player does. Review the opening first when earlier choices or approved appearances differ from its literal text.

**Choose next scene** lets you skip to another scene or select no next scene. Selecting a scene does not insert it; Force or an automatic handoff does. Choosing an earlier scene can replay it, so review continuity first.

**Undo last scene insertion** removes only the latest Set Points scene message and restores the previous selection. It is available only before another conversation message is added and while that inserted message remains unedited. It does not undo the preceding model reply. A consumed handoff stays consumed; use Force to intentionally reinsert the scene.

Automatic progression only runs on normal completed replies. Regenerate, swipe, continue, impersonation, stopped generations, edits, and history rendering do not advance. Force and selection changes wait until an active generation ends. Edited/deleted scene messages or changes to the card's scene data pause progression for review.

Version 0.1 supports a single narrator character per chat. Group chats, strict prerequisite gates, automatic world-book stage switching, and automatic rewriting of later scenes after a divergent choice are outside this version.

## Story length and adaptation quality

The importer accepts up to **500,000 characters** and at most **48 sections**. The default section size is 12,000 characters, adjustable from 4,000 to 20,000. The interface requests 2–24 scenes; fewer may be returned if the source does not support the requested number. The draft format supports up to 32.

Section ledgers are merged in groups that fit the actual request budget. Each serialized model request is checked against a **256,000-character** cap before sending. If even a pair of summaries cannot fit, the import stops locally without a new paid request and keeps the saved work. Names, aliases, relationships, events, and source-section references are preserved where possible. The importer checks structure and section coverage; this cannot establish that every detail was understood correctly. Condensation and dropped cast members are flagged when detectable. Review novel-length adaptations carefully.

Starting cast and lore are intended to describe the chosen starting point. Later revelations belong in scene direction. This is model-guided handling, not guaranteed spoiler containment: the model sees the next scene privately and may infer or reveal more than intended. There are no hard prerequisite checks in this version.

After reading and merging the source, Set Points creates a compact adaptation plan, then generates cast and lore in batches of at most **four entries**, and scenes in batches of at most **two**. Each completed plan or batch is saved separately. It no longer sends a new request to generate the entire card in one response. A valid complete legacy final response or its saved format repair can still be reused from cache; partial or truncated legacy card output is not salvaged.

Each adaptation-model request has a **ten-minute deadline**. The default output allowance remains **16,000 tokens**, with reasoning inherited from the connection. A small-context model may need shorter sources or fewer scenes. Cancellation and failed/refused/truncated responses do not silently replace a completed draft. Invalid output receives at most one format-repair attempt; a provider refusal is not retried as a formatting error. More, smaller batches can increase input-token charges, so this approach does not promise a lower total import cost.

The **24,000-character** intermediate-summary size is a prompt target, not an acceptance limit. A structurally valid original ledger up to **192,000 characters** is retained without shortening. Set Points makes no new paid compaction requests. If a valid compacted response from 0.1.3 is already saved, it may be reused to preserve matching downstream merge results; otherwise the original saved ledger is kept unchanged. Final character-card limits, source-reference validation, and markup restrictions remain strict.

## Model response settings

In **Model response settings**, choose a response allowance of **8,000**, **16,000** (default), **32,000**, or **64,000** output tokens. Reasoning choices are **Use connection settings** (default), **Off**, and **Low**. These are per-import request choices; they do not edit the saved Lumiverse connection profile. Larger allowances may cost more, and a provider may reject an allowance or reasoning override it does not support.

The selected allowance is sent in the raw generation parameters, which normally override the preset’s output limit. A custom request body in the host can override those parameters, and the provider’s own limits still apply. The selected number is a requested allowance, not a guarantee. The Spindle raw-generation API is described in [Lumiverse’s generation documentation](https://docs.lumiverse.chat/backend-api/generation/).

For OpenRouter, **Off** sends the host’s explicit `effort: "none"` control because Lumiverse 1.2.0’s generic off path merely removes the reasoning parameter. Other providers use the host’s off control. Provider/model support still applies. Inherited global reasoning and custom-body settings are resolved by the host and are not fully exposed to the extension; explicit **Off** or **Low** uses a per-request override.

For a failed or cancelled import, use the separate **Unfinished response allowance** and **Unfinished reasoning mode** controls next to **Resume saved import**. Changing them applies only to unfinished requests. Completed matching source-reading, merge, plan, and batch results are reused even when these choices change. Selecting settings does not send a request: click Resume deliberately when ready, with the normal cost of remaining requests understood. Set Points does not automatically increase the allowance, change reasoning, or retry the provider.

The neutral **Check connection** request remains limited to **256 output tokens** and **30 seconds**. It does not use the adaptation’s larger allowance and cannot establish that a full story request will succeed.

## Saved progress and resuming

**Resume saved import** appears when the last saved attempt failed or was cancelled. It uses that attempt’s saved story and import setup, including after a restart. It does not replace or use edits currently in the source form. The separate unfinished-request controls can override only response allowance and reasoning. Completed matching steps are reused; any remaining model requests incur normal provider charges.

Responses are saved before format and size validation. Completed compatible steps are reusable when the original story/request messages and model profile still match, even if you change the response allowance or reasoning mode for unfinished requests. Other source, profile, or request changes may require new calls; Resume stops if the saved connection profile changed. Changing only the player role or scene count in a new import can still reuse identical source-reading prompts. Legacy prompts and checkpoint `FORMAT 1` remain available for 0.1.3/0.1.4 recovery; a cosmetic version change does not invalidate saved responses.

If a request’s outcome is unknown, Set Points never automatically repeats it. **Retry unfinished request** warns that the earlier request may already have been charged and that retrying can charge it again. Choosing that button explicitly authorizes repeating the uncertain request. This differs from reusing a completed response already saved locally.

Saved progress starts with imports run under 0.1.3. Versions 0.1.5–0.1.7 can reuse those saved responses after a compaction or output-limit failure, provided the extension storage remains intact. Complete legacy final-card results can be reused, but partial or truncated final-card output is not converted into new batches. Resuming still incurs normal charges for remaining uncached merge, plan, or batch requests; it does not make the entire import free. Earlier failed runs from 0.1.2 did not save their responses and cannot be recovered by this update.

## Content and data

The selected Lumiverse connections perform adaptation and optional image descriptions; your normal chat connection performs roleplay. Their content rules and behavior apply independently. Set Points has no added story-genre filter and does not attempt to bypass provider restrictions. The connection check uses the same selected connection and runs only when you click **Check connection**. It preserves source text, staged pages, and drafts. A blank, limited, reasoning-only, or failed response is reported as an unsuccessful check; a successful neutral check does not establish that a full story adaptation will be accepted.

Raw adaptation and normal chat use the host’s shared credential path, but their prompts and generation settings differ. Success in chat alone cannot identify the cause of an adaptation failure. Set Points keeps your chosen model and inherits reasoning unless you explicitly select a per-import override. It does not automatically retry provider failures or switch models. The existing single format-repair attempt remains available for malformed output and uses normal charges when no matching response is saved. Compaction results are read from existing checkpoints only; this version sends no new compaction requests.

When an import begins, its raw source text and options are saved in Lumiverse’s private per-user extension storage so the last attempt can resume after a restart. That storage also holds cached model reply content and reasoning, with minimal response metadata, saved before format and size validation. Opaque provider details are excluded. These checkpoints contain story material and are separate from diagnostic exports, which exclude source text, response prose, and reasoning text.

Completed drafts, job status, and card-save receipts also use per-user extension storage; scene progress is stored with its chat. Optional image descriptions additionally store the matched original source, the selected description draft and settings, the description pack, and cached model responses privately per user. These may contain source facts, evidence excerpts, suggestions, model response prose, and reasoning; they are story content and are excluded from diagnostic exports. Source-form edits that have not been submitted as an import can still be lost when the interface reloads. A draft includes adapted prose and its source title/URL, so treat exported drafts as story content. Description-pack exports contain character descriptions, tags, suggestions, and source references; treat them as story content too.

The optional link reader fetches the pages you select through Lumiverse's proxy without supplying login cookies. It extracts text without executing page scripts or loading page assets. Login walls, anti-bot checks, and JavaScript-only pages may require pasted text. Public hostname checks do not replace the host's network policy.

Only `{{user}}` and `{{char}}` display placeholders are accepted in generated/reopened drafts. Active template expressions, HTML, and reserved scene-control markers are rejected before saving a card.

## Troubleshooting

- **Only part of a web story loads:** use **Read linked pages** from the first page. Check the collected-page list and stopping message. Supply explicit URLs in **Other page links** if automatic navigation cannot identify the next page.
- **No adaptation connection:** add a model connection in Lumiverse and grant `generation`, then refresh Set Points.
- **Connection has no model:** select and save a model in that Lumiverse connection before trying again. Set Points validates the model before requesting an adaptation.
- **An adaptation fails at the first request:** update to 0.1.7, choose the intended connection, and click **Check connection**. Record its displayed result, then try your adaptation separately if appropriate. If it fails, record the new error code and use **Download diagnostics**. The neutral check sends no story text, makes a small billable request, and preserves your current work.
- **Resume says the connection changed:** restore the connection settings used for the saved attempt, or deliberately choose **Create adaptation** with the new settings and normal model charges. Resume stops before dispatching a request when the saved profile no longer matches.
- **HTTP 403:** `REQUEST_DENIED` means the provider denied the request without enough evidence to establish why. It is not automatically labeled invalid credentials or content moderation. `DECLINED` is used when explicit provider refusal or policy indicators are present.
- **An output limit stops adaptation:** check the failed stage shown in the progress area. You may explicitly choose a larger **Unfinished response allowance** or a supported reasoning override before **Resume saved import**. Completed matching steps are reused; remaining calls still incur normal charges. The provider may reject larger allowances or overrides.
- **Blank or incomplete output:** diagnostics distinguish `EMPTY_RESPONSE`, `REASONING_ONLY`, `OUTPUT_LIMIT`, and `RESPONSE_FAILED` when the available metadata supports it. An empty answer without a precise stop reason remains unexplained. Review the reported category before changing your connection settings.
- **A paid import stopped after reading the story:** use **Resume saved import** to reuse matching completed steps from the last saved attempt. Remaining requests still cost money. This recovery is available for imports started in 0.1.3, not earlier failed runs.
- **Retry unfinished request:** the earlier request’s outcome is unknown and it may already have been charged. Use this explicitly warned action only when you want to send that request again.
- **A 0.1.3 compaction failure:** update to 0.1.7 without uninstalling or clearing storage, then use **Resume saved import**. Valid original summaries within the 192,000-character limit can continue without a new compaction request. Remaining uncached requests still use normal model charges.
- **A summary or merge cannot fit:** the importer checks its summary and serialized-request limits locally and retains saved work. If even two summaries cannot fit in a merge request, changing the relevant input may be necessary. Do not repeatedly resend an unchanged request expecting the size limit to change.
- **Refused, incomplete, or malformed output:** inspect the displayed error. Check the connection, shorten the source, reduce scenes, or reduce section size as appropriate. A refusal and a broken response are different outcomes.
- **Image descriptions need the original source:** read its linked pages in the description panel, paste the matching story, or explicitly copy it from Import and review it. Older drafts may need this once. Resume uses the source already saved for its attempt.
- **I only want to set a character’s appearance:** edit their approved appearance and starting outfit in Review and save the draft. Existing drafts need no reimport, source text, or paid analysis for this.
- **Approved appearances conflict with a scene:** review possible matches with **Scan appearance mentions**, then edit the relevant lore or scene text. The guide influences narration; it does not rewrite literal scene openings.
- **Image descriptions are hidden or Resume is unavailable:** the current draft fields differ from the saved description request/result. Return to that version or deliberately create descriptions for the current version; Set Points will not silently use another draft’s source.
- **`grounding.description[0] must be text`:** update to 0.1.7 in place and choose **Resume saved descriptions** on the matching draft. The reader now accepts common nested and object-shaped fact references while checking their IDs. Saved compatible responses are reused; any unfinished profile or repair requests still incur normal charges. No new paste or adaptation is required.
- **An image-description request stops:** use **Resume saved descriptions** for the matching draft to reuse saved completed steps. Remaining requests cost money. An unknown outcome requires the separately warned retry action.
- **Cannot copy descriptions:** when clipboard access is unavailable, use the selected text and your keyboard or context menu to copy manually.
- **Export did not save a file:** use the visible **JSON backup**. Try **Download JSON**, or **Copy backup** and save the complete text in a plain-text editor using the shown filename. A draft backup can also be restored with **Paste draft backup**.
- **Scene will not advance:** check Follow is on, a next scene is selected, and all scene permissions are granted. Automatic handoff depends on the model following its direction. Force remains available.
- **An interrupted save:** retry the same reviewed draft. Owned resource markers let Set Points find an existing card or complete a partial world book. It does not delete partial work automatically. A changed draft is a new save and may produce another card.
- **Undo unavailable:** another message was added, the inserted scene was edited/removed, or a reply is in progress. Review the conversation before changing the next selection.
- **Need a bug report:** after the check or failed adaptation, use **Download diagnostics**. It includes version, job counts/status and failed phase, chat/job identifiers, scene indices, operation statuses, allowlisted finish/stop codes, text and reasoning lengths, and numeric usage where available. It excludes story prose, source URLs, raw provider responses, credentials, and reasoning text. Unknown stop codes are replaced with a generic marker. A short neutral reproduction is useful, though it cannot test every story-specific extraction failure.

## Development and verification

```sh
npm ci
npm run check
bun test
npm run build
```

The backend and frontend are bundled separately. Source/API compatibility was checked against the official Lumiverse host implementation as well as the published types; in particular, generated replies bypass the REST message-processor path, so handoff processing reads the saved reply from the completion event.

The local preview in `dev/preview.html` uses a mocked host and model. Build it with `bun build dev/preview.ts --outdir dev/build --target browser`, serve the repository with a static HTTP server, and open `/dev/preview.html`. It demonstrates the interface; it does not validate a real provider or installation.

The test suite covers source extraction, long-source merging, schema/refusal/truncation errors, cancellation, draft isolation, partial-save recovery, permission changes, direct host-shaped generated replies, duplicate/stale handoffs, scene edits, Undo, and interface state preservation. Checkpoint tests cover reuse after restart and explicit authorization before repeating a request with an unknown paid outcome. Release-specific coverage includes large-ledger preservation, cache-only legacy response reuse, staged plan/batch generation, response-setting changes, failed-phase retention, and request-budget checks. Appearance tests cover manual approval on existing drafts without model calls, card/world-book consistency, changed-guide save receipts, source/result binding, canonical versus suggested fields, tag formatting, separate persistence, cancellation/resume, clipboard fallback, and preserving edits. See `BUILD-REPORT.md` for release-specific verification and outstanding live checks.

## Credits

[Waypoints by ajrc0re](https://github.com/ajrc0re/LumiverseWaypoints) inspired the scene-destination concept and the Force/Undo interaction. Set Points is independently implemented; no Waypoints code or artwork is included.

Built for [Lumiverse](https://lumiverse.chat/) using its documented Spindle APIs. Web text extraction uses Mozilla Readability and linkedom. Bundled third-party licenses are in `licenses/`.
