# Set Points 0.1.6 — verification

Prepared October 9, 2026.

## Change in 0.1.6

Manual approved appearance and starting-outfit fields are available in Review for every existing draft, including completed 0.1.5 drafts. Editing and saving them makes no model request and needs neither reimport nor original source text. The optional `StoryDraft.appearances` field is validated, saved, and included in draft JSON. Publishing includes the same guide in the card description and a dedicated always-on **Approved character appearances** world-book entry, with a matching narrator rule.

The approved guide takes priority over incidental conflicting prose. Physical traits require explicit human approval to change; starting clothes can change through an explicit story action. Blank fields stay unspecified. Existing cast/lore entries and literal scene openings remain intact. **Scan appearance mentions** is a local keyword locator for manual review, not an exhaustive search or semantic conflict checker. It does not rewrite scenes, and Force inserts the existing opening literally. Model adherence is not guaranteed.

Image descriptions remain an optional, separate step. The extension rereads the explicitly selected original source, extracts appearance facts with evidence from source sections, and builds editable profiles for the existing cast. Source appearance and starting outfits are separate from suggestions and unknown traits. Later or uncertain facts are excluded from starting defaults. Generation alone does not change approved story details or publish a card. **Use these appearances in story** explicitly copies only the displayed source appearance and outfit prose into the approved fields, converts unspecified facts to blanks, and excludes suggested details and tags. The user reviews and saves that change.

Descriptions use additional text-model requests with normal provider charges. They do not generate images. Completed matching requests are cached, while unfinished requests still incur normal charges. The response allowance and reasoning controls remain explicit user choices; there is no automatic provider retry or model switch. A malformed result can use the existing single format-repair attempt, with normal charges when its matching response is not already saved.

## Review and image-tool workflow

The optional panel offers editable appearance, starting outfit, caption subject, appearance/outfit tags, and separately labeled suggested details/tags. The canonical tag copy buttons supply the corresponding Appearance and Outfit fields in [Lumi Studio](https://github.com/fidgetycarrot/lumidraw-studio). Starting-outfit tags are bounded to 12 for Lumi Studio compatibility; appearance and suggested lists allow up to 32 each, with detailed outfit prose retained separately. Separate prose-copy buttons are available, along with a combined Anima tag prompt and natural-language caption. Suggestions enter combined prompts only when the user checks the default-off inclusion control; dedicated appearance/outfit tag copies remain canonical.

Each cast member also has **Copy [character] approved caption**, containing only their approved prose. A mismatch notice appears when that prose differs from the matching source-analysis description or outfit. Source tag and caption buttons retain the separately edited source-analysis fields; manual approved prose is not automatically converted into image tags. No external Lumi Studio writes are made.

Anima supports tags, captions, and mixtures of both, with lowercase tags and spaces instead of underscores. Set Points leaves quality, rating, style, model, and other preset choices to the image tool; it adds no image generation or automatic synchronization. Format references were checked against the [official Anima README](https://huggingface.co/circlestone-labs/Anima/blob/main/README.md). Clipboard failures select the text for manual copying instead of reporting a successful copy.

**Save descriptions** persists a separate `VisualPack`; **Export descriptions** prepares that pack as JSON. Story-draft exports include explicitly approved appearance prose, but exclude the separate pack and its unapproved suggestions. The panel remains separate from the main editor so progress updates preserve story edits. Unsaved description edits survive incoming results until the user deliberately loads the new descriptions.

## Backup and restore

Draft, description-pack, and diagnostic exports expose the complete JSON and suggested filename in a visible **Your JSON backup** panel before requesting a download. **Download JSON** retries, and **Copy backup** provides clipboard copying with text selection for manual copying when unavailable. The interface reports only that a download was requested, never that a file was saved. Users can save the visible JSON in a plain-text editor.

**Open draft** and **Paste draft backup → Open pasted draft** validate story-draft backups before replacing Review. Newer edits made while a restore is pending remain visible until **Load new draft** is chosen. Description-pack and diagnostic JSON are not accepted as story drafts. Pretty-printed backup input can be up to 384,000 characters; the validated draft still has the existing 192,000-character bound. Restore and manual appearance editing do not make model requests.

## Source binding, recovery, and private data

A newly completed adaptation records a binding between its original source and the draft fields used for visual analysis. Existing 0.1.5 drafts and relevant draft edits may need the original source supplied explicitly. The panel offers a separate paste field and **Use story text from Import**; that button copies for review and does not submit a request. An explicit **Use different story text** control lets the user correct an already matched source before deliberately starting another request. The backend does not infer source ownership from the most recent import.

This source requirement applies only to optional paid appearance analysis. Existing drafts can be opened, edited, given approved appearances, saved, and published immediately without supplying or rereading the source. Saving approved details preserves the completed import and its paid response files. A changed guide creates a new publication under the existing receipt semantics; identical saves reuse their card and world book. Previously published cards and live chats are not updated automatically.

The source, result, and saved description request each carry a draft-revision binding. Results and Resume are offered only when they match the current draft basis. The backend validates incoming drafts and packs. Description generation is isolated from the main adaptation job; concurrent model operations are blocked while ordinary Review edits remain possible.

The saved description input includes its draft, original source, connection, and response settings. The matched source, edited pack, job state, cached source analysis, profile responses, reasoning, and minimal response metadata use Lumiverse’s private per-user extension storage. Evidence excerpts and generated descriptions are story material. Diagnostic exports exclude them, source text, source URLs, character names, raw provider details, credentials, and reasoning text.

Cancel retains completed work. Resume uses the saved description input independently of the current Import form and can reuse completed compatible requests across selected response-allowance or reasoning changes. An unknown request outcome requires the explicitly warned **Retry unfinished description request**; it may already have been charged and retrying may charge it again. Restart recovery keeps the previous story and descriptions. Update in place and preserve extension storage.

The 0.1.5 staged adaptation path and legacy checkpoint `FORMAT 1` recovery remain available: compact plan, cast/lore batches of at most four entries, and scene batches of at most two. Complete compatible legacy final answers can be reused from cache; truncated answers are not salvaged into new batches. No new paid compaction request is introduced. Failed 0.1.2 runs without saved responses remain unrecoverable.

## Current release verification

The complete 0.1.6 suite passes: **326 tests, 1,827 assertions, 13 test files**. TypeScript checking passes. Bun 1.4.2 produced backend **561,521 bytes**, frontend **96,844 bytes**, and mocked preview **110,221 bytes**. The official Lumiverse 1.2.0 capability scanner reports no undeclared capabilities with the existing `base64_decode` declaration.

Publisher tests cover always-on approved guidance, identical card/world-book prose, JSON roundtrip, unchanged legacy entries, changed-guide receipts, double-click/restart deduplication, and interrupted publication. Backend coverage includes adding and saving approved appearances to a completed 0.1.5 draft with zero model calls and unchanged saved import inputs. Frontend checks cover manual approval, source-only copying, the appearance locator, approved-caption differences, explicit source selection, source/result/request revision binding, separate packs, preservation of edits, cancellation/resume, unknown outcomes, visible JSON backup, paste restoration, and clipboard failure.

No live provider appearance run, successful live story adaptation, or image-generation quality check is claimed. The interface was tested through DOM tests; browser-preview access was blocked, so no live host screenshot review is claimed. Neutral fixtures and mocked requests do not establish source-extraction accuracy, provider acceptance of the selected settings, or compatibility with every live host configuration. No new dependency audit is claimed.

## Previous release verification references

These historical results do not verify 0.1.6:

| Version | Tests | Assertions | Test files |
| --- | ---: | ---: | ---: |
| 0.1.5 | 243 | 1,416 | 10 |
| 0.1.4 | 207 | 1,159 | 8 |
| 0.1.3 | 190 | 1,079 | 8 |
| 0.1.2 | 123 | 663 | 7 |
| 0.1.1 | 103 | 427 | 7 |

Version 0.1.5 passed TypeScript and Bun 1.4.2 builds: backend 526,701 bytes, frontend 65,112 bytes, mocked preview 75,622 bytes. The Lumiverse 1.2.0 capability scanner accepted its existing `base64_decode` declaration. Neutral upgrade fixtures generated by the actual published 0.1.4 backend tested output-limit recovery and unknown paid-request outcomes; a saved 0.1.3 compaction failure also resumed. These tests did not use a user story or a live provider.

## Still to verify in a live installation

1. Update to 0.1.6 in place, preserving private extension storage. Confirm an existing draft and saved import remain available. Edit and save approved appearance fields without a model request or reimport.
2. Export a draft; confirm the visible JSON backup remains usable when downloading or clipboard access is blocked. Restore a draft through the file or paste controls.
3. Publish a reviewed draft and check the approved guide in both its card and always-on world-book entry. Check possible conflicts in existing lore and literal scene openings.
4. If wanted, open optional Image descriptions. Verify the source is matched or explicitly paste/copy the correct story before starting a normally charged request. Review facts, unknowns, outfits, and suggestions; confirm later changes have not become starting defaults.
5. Save the separate descriptions. Deliberately approve source prose with **Use these appearances in story**, or keep manual choices. Copy the approved caption or reviewed tags into Lumi Studio manually and choose model and preset settings there.
6. If generation stops, check its retained phase and error category. Resume completed matching work, or explicitly authorize an uncertain retry after reading its charge warning. Download diagnostics if further troubleshooting is needed.

Repository installation target: [fidgetycarrot/lumiverse-set-points](https://github.com/fidgetycarrot/lumiverse-set-points).
