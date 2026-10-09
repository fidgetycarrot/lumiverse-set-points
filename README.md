# Set Points

**A story. Your choices.**

Set Points adapts story text into a playable Lumiverse narrator card, supporting cast, world book, and a sequence of scenes. Review the adaptation, choose your role, and decide whether to follow the source or explore freely.

Version **0.1.1** adds multi-page story collection. It has automated tests and an interactive interface preview; it has not yet been exercised end to end inside a live Lumiverse installation with a real model connection.

## What it does

- Accepts pasted text and `.txt` / `.md` files. Link import can collect a sequence of readable story pages for you to inspect before adaptation.
- Lets you choose a model connection, player role, starting point, and desired scene count.
- Reads long sources in sections, merges character identities and chronology, then creates an editable adaptation.
- Produces a narrator card, attached world book, initial greeting, and ordered alternate greetings.
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

| Permission | Used for |
| --- | --- |
| `generation` | Adaptation requests, connection choices, and generation lifecycle tracking |
| `characters` | Creating narrator cards and reading their scene data |
| `world_books` | Creating and attaching starting cast and lore |
| `chats` | Finding and validating the selected chat |
| `chat_mutation` | Inserting, cleaning, and undoing scene messages |
| `interceptor` | Adding current/next scene direction before a normal reply |
| `cors_proxy` | Optional web-page extraction; pasted text works without it |

The declared `base64_decode` backend capability is needed by a bundled DOM-parser fallback. Set Points does not evaluate imported source code or request dynamic-code-execution capability.

## First story

1. In **Import**, paste a story, open a text file, or choose **Try a sample**. For a multi-page story, open **Import from a link**, enter the first page, and choose **Read linked pages**. Review the collected pages, then choose **Use collected text**. **Read page** loads just the selected page.
2. Enter the story title, who you will play, and where play begins. Choose the adaptation connection. The role may be an existing character or a new one.
3. Choose **Create adaptation**. Each section, merge, and final adaptation uses that connection and its normal provider charges. You can cancel while keeping your previous completed draft.
4. In **Review**, edit the premise, cast, starting knowledge, world lore, narrator instructions, and scenes. Check adaptation notes and each scene's continuity assumptions. Export the draft if you want a backup.
5. Choose **Save to Lumiverse**. Set Points creates one narrator card and attaches its world book. It does not activate the world book globally or overwrite existing cards. Repeating the identical save recovers the existing card rather than duplicating it.
6. Open the new character from Lumiverse's **Characters** browser and start a chat with its initial greeting. Return to Set Points' **Play** tab.

The examples folder includes a short original sample story and a validated sample draft. Use **Open draft** in Review to try saving a card without making an adaptation-model request.

## Multi-page web stories

**Read linked pages** follows one clear next-page link at a time, on the same website, starting at the URL you enter. It checks navigation before extracting story text, including Literotica’s numbered story-page links. It does not automatically collect a separate series or guess chapter URLs. If a story starts on an earlier page, enter that first-page URL.

For sites with unclear links, put additional page URLs in **Other page links**, one per line in reading order. These form an explicit list after the first page; automatic discovery is not used for that list. Every retry starts again from the first URL, so include every subsequent page, including any already collected. All pages must share the same website origin.

Collection is limited to **100 pages** and **500,000 combined characters**, including page separators. It stops on ambiguous links, repeated URLs or text, a failed page, cancellation, or a size limit. The collected-page list and stopping message let you see what was loaded; the absence of a next-page link does not prove the story is complete.

Your current story text and title remain in place while pages load. Review the collected pages and choose **Use collected text** to replace them. If collection stops partway, you can keep the pages collected so far or correct the links and try again. Loading pages does not call your adaptation model. You choose **Create adaptation** separately.

## Scene controls

**Follow the story** is off in new chats. Turn it on to add private direction for the current scene and selected next scene. The model is asked to bring the situation to the next scene's doorstep while leaving the player's speech, thoughts, choices, and actions to them. When a normal completed reply includes the one-use handoff signal, Set Points removes it from the saved reply and appends the selected scene opening.

**Force next scene** immediately inserts the selected opening, including when following is paused. It does not generate a bridge or choose what the player does. Review the opening first when earlier choices have diverged from the source.

**Choose next scene** lets you skip to another scene or select no next scene. Selecting a scene does not insert it; Force or an automatic handoff does. Choosing an earlier scene can replay it, so review continuity first.

**Undo last scene insertion** removes only the latest Set Points scene message and restores the previous selection. It is available only before another conversation message is added and while that inserted message remains unedited. It does not undo the preceding model reply. A consumed handoff stays consumed; use Force to intentionally reinsert the scene.

Automatic progression only runs on normal completed replies. Regenerate, swipe, continue, impersonation, stopped generations, edits, and history rendering do not advance. Force and selection changes wait until an active generation ends. Edited/deleted scene messages or changes to the card's scene data pause progression for review.

Version 0.1 supports a single narrator character per chat. Group chats, strict prerequisite gates, automatic world-book stage switching, and automatic rewriting of later scenes after a divergent choice are outside this version.

## Story length and adaptation quality

The importer accepts up to **500,000 characters** and at most **48 sections**. The default section size is 12,000 characters, adjustable from 4,000 to 20,000. The interface requests 2–24 scenes; fewer may be returned if the source does not support the requested number. The draft format supports up to 32.

Section ledgers are merged in bounded groups to avoid a single unbounded merge request. Names, aliases, relationships, events, and source-section references are preserved where possible. The importer checks structure and section coverage; this cannot establish that every detail was understood correctly. Condensation and dropped cast members are flagged when detectable. Review novel-length adaptations carefully.

Starting cast and lore are intended to describe the chosen starting point. Later revelations belong in scene direction. This is model-guided handling, not guaranteed spoiler containment: the model sees the next scene privately and may infer or reveal more than intended. There are no hard prerequisite checks in this version.

Each model request has a three-minute deadline and requests up to 16,000 output tokens. A small-context model may need shorter sources or fewer scenes. Cancellation and failed/refused/truncated responses do not silently replace a completed draft. Invalid output receives at most one format-repair attempt; a provider refusal is not retried as a formatting error.

## Content and data

The selected Lumiverse connection performs adaptation; your normal chat connection performs roleplay. Their content rules and behavior apply independently. Set Points has no added story-genre filter and does not attempt to bypass provider restrictions.

Raw pasted source is kept in the current interface and sent to the selected model for adaptation. It is not saved as a separate source file by the extension. Closing/reloading the interface can lose unsaved source text. Completed drafts, job status, and card-save receipts are stored in Lumiverse's per-user extension storage. Scene progress is stored with its chat. A draft includes adapted prose and its source title/URL, so treat exported drafts as story content.

The optional link reader fetches the pages you select through Lumiverse's proxy without supplying login cookies. It extracts text without executing page scripts or loading page assets. Login walls, anti-bot checks, and JavaScript-only pages may require pasted text. Public hostname checks do not replace the host's network policy.

Only `{{user}}` and `{{char}}` display placeholders are accepted in generated/reopened drafts. Active template expressions, HTML, and reserved scene-control markers are rejected before saving a card.

## Troubleshooting

- **Only part of a web story loads:** use **Read linked pages** from the first page. Check the collected-page list and stopping message. Supply explicit URLs in **Other page links** if automatic navigation cannot identify the next page.
- **No adaptation connection:** add a model connection in Lumiverse and grant `generation`, then refresh Set Points.
- **Refused, incomplete, or malformed output:** inspect the displayed error. Check the connection, shorten the source, reduce scenes, or reduce section size as appropriate. A refusal and a broken response are different outcomes.
- **Scene will not advance:** check Follow is on, a next scene is selected, and all scene permissions are granted. Automatic handoff depends on the model following its direction. Force remains available.
- **An interrupted save:** retry the same reviewed draft. Owned resource markers let Set Points find an existing card or complete a partial world book. It does not delete partial work automatically. A changed draft is a new save and may produce another card.
- **Undo unavailable:** another message was added, the inserted scene was edited/removed, or a reply is in progress. Review the conversation before changing the next selection.
- **Need a bug report:** use **Download diagnostics**. It includes version, job counts/status, chat/job identifiers, scene indices, and operation statuses; it excludes story prose and raw model/provider errors. A short neutral reproduction is useful, though it cannot test every story-specific extraction failure.

## Development and verification

```sh
npm ci
npm run check
bun test
npm run build
```

The backend and frontend are bundled separately. Source/API compatibility was checked against the official Lumiverse host implementation as well as the published types; in particular, generated replies bypass the REST message-processor path, so handoff processing reads the saved reply from the completion event.

The local preview in `dev/preview.html` uses a mocked host and model. Build it with `bun build dev/preview.ts --outdir dev/build --target browser`, serve the repository with a static HTTP server, and open `/dev/preview.html`. It demonstrates the interface; it does not validate a real provider or installation.

Tests cover source extraction, long-source merging, schema/refusal/truncation errors, cancellation, draft isolation, partial-save recovery, permission changes, direct host-shaped generated replies, duplicate/stale handoffs, scene edits, Undo, and interface state preservation.

## Credits

[Waypoints by ajrc0re](https://github.com/ajrc0re/LumiverseWaypoints) inspired the scene-destination concept and the Force/Undo interaction. Set Points is independently implemented; no Waypoints code or artwork is included.

Built for [Lumiverse](https://lumiverse.chat/) using its documented Spindle APIs. Web text extraction uses Mozilla Readability and linkedom. Bundled third-party licenses are in `licenses/`.
