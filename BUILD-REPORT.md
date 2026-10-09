# Set Points 0.1.3 — verification

Prepared October 8, 2026.

## Change in 0.1.3

This update adds durable import recovery and more precise diagnostics. An unexplained HTTP 403 is classified as `REQUEST_DENIED` instead of being assumed to be an authentication failure. Explicit provider policy/refusal indicators are classified as `DECLINED`. Native stop and refusal metadata distinguish failed responses, output limits, reasoning-only responses, and empty answers when the host supplies enough information.

**Check connection** sends a small neutral request through the selected connection only when the user chooses it. Normal model charges apply. It preserves the source text, staged pages, and draft. Blank, limited, reasoning-only, and failed test responses are not reported as successes. A successful neutral reply does not prove that a full adaptation request will be accepted.

Diagnostic exports retain only allowlisted stop/finish categories, lengths, and numeric usage for model-response details. They do not include response prose, secrets, raw provider payloads, or reasoning text. The chosen model and reasoning settings are preserved. Provider failures are not automatically retried, and models are not switched. The existing single format-repair attempt and the new single bounded compaction attempt are distinct processing steps; new requests use normal provider charges. Existing multi-page collection, review, card publishing, and scene controls remain available.

## Saved progress, compaction, and storage

The last import’s raw source text and options are saved privately per user before model generation. Model reply content and reasoning, plus minimal metadata, are saved before format/size validation; opaque provider details are excluded. This permits resume across a restart and recovery from a later local validation failure. These private records contain story material. Diagnostics do not include their source, response prose, or reasoning text.

Reuse matches exact request messages, a connection/profile fingerprint, and sampler parameters. Its revision remains stable across cosmetic releases. Changed request messages, model/profile, or parameters require new calls. Role or scene-count changes can still reuse identical source-reading requests. **Resume saved import** uses the saved attempt’s inputs, preserving edits currently in the form; unfinished requests still use normal provider charges.

An unknown request outcome requires the explicitly warned **Retry unfinished request** action because it may already have been charged. It is never automatically repeated. Earlier failed 0.1.2 runs cannot be recovered because their responses were not saved.

An oversized intermediate ledger receives at most one bounded compaction attempt using the existing summary. The preservation checks cover records, relationships, warnings, event order, and source references. Compaction is an additional normally charged call unless its response is already saved. `COMPACTION_IMPOSSIBLE` stops before that call if the immutable information alone exceeds the limit; an identical cached repeat makes no new model call and requires changed input to progress.

Workspace writes also use verified temporary files and rename recovery. Corrupt saved inputs block new paid requests. Resume compares the saved connection profile with the current profile and stops before billing if those settings changed.

## Current release verification

- TypeScript check passed.
- 190 automated tests passed across eight test files (1,079 assertions).
- Production bundles built with Bun 1.4.2: backend 0.50 MB, frontend 61.1 KB, and local preview 71.56 KB.
- The Lumiverse 1.2.0 capability scanner accepted the backend with only `base64_decode` declared; no other capability requirements were reported.
- Tests cover native stop/refusal metadata, blank and reasoning-only responses, output limits, safe diagnostic redaction, and the neutral connection check.
- Tests cover source-reading reuse after restart, oversized-ledger compaction followed by resume, exact request/profile matching, preservation of current form edits, and explicit authorization before repeating an uncertain paid request.

These checks use mocked host dispatch and model responses. No successful live provider adaptation is claimed. No new dependency-audit result is claimed for 0.1.3.

## Previous release reference: 0.1.2

Adaptation requests now include the selected connection’s provider and model explicitly. The previous request supplied only `connection_id`; Lumiverse’s raw generation API resolves connection credentials but does not infer the model, so the upstream request could contain an empty model name. Set Points also validates that a model is configured and reports categorized connection/provider failures without copying raw responses, story prose, or secrets into errors or diagnostics.

The multi-page importer, editable drafts, card publishing, and scene controls from 0.1.1 are retained.

The following results belong to 0.1.2 and are not verification of the 0.1.3 diagnostic changes:

- TypeScript check passed.
- 123 automated tests passed across seven test files (663 assertions).
- Production bundles built successfully with Bun 1.4.2: backend 0.48 MB and frontend 57.41 KB.
- The Lumiverse 1.2.0 capability scanner accepted the compiled backend with `base64_decode` declared; no other capability requirements were reported.
- Tests mock the raw host generation dispatch for three provider profiles, checking that the selected provider and model are passed explicitly. Tests also cover error redaction, status handling, and cancellation.

These checks use mocked host dispatch, not live providers. No successful live Lumiverse generation had been verified for that release. Dependencies are unchanged; no new dependency audit is claimed for 0.1.2.

## Previous release reference: 0.1.1

The following results belong to 0.1.1 and are not verification of the 0.1.3 diagnostic changes:

- TypeScript check completed successfully.
- 103 automated tests passed across seven test files (427 assertions).
- Backend and frontend production bundles built successfully with Bun 1.4.2.
- Production dependency audit reported no known vulnerabilities at build time.
- The Lumiverse 1.2.0 backend capability scanner accepted the compiled backend with the declared `base64_decode` capability; no other blocked capabilities were reported.
- API integration was checked against Lumiverse 1.2.0 and current host source. Tests include the released host's interceptor fields and saved-message generation flow.
- The browser preview was visually inspected in dark and light themes. Its mocked Force and Undo controls updated the displayed scene state.
- The included sample draft passes the production draft validator.
- The updated browser preview collected three neutral sample pages in order and applied their combined text only after the explicit Use collected text action.
- Literotica's current rendered story-page navigation was inspected on October 8, 2026: numbered `?page=N` links and an accessible “Next Page” link inside its pagination navigation. Neutral fixtures exercise this structure and the older pagination structure. This verifies link recognition, not an end-to-end live import through Lumiverse.

The 0.1.1 automated coverage included source parsing and length limits; character/scene schema validation; long-source merging; model refusals, truncation, cancellation, and format repair; per-user draft isolation; interrupted card saves; permission changes; scene handoff identity; duplicate and stale event handling; Undo restrictions; and preservation of unsaved review edits. Multi-page coverage checks ordered collection, exact source attribution, explicit application, partial failures, caps, duplicate pages, same-site boundaries, and cancellation with late responses.

## Still to verify in a live installation

The user reported an HTTP 403 with Gemini 3.1 Pro and a blank response with Gemini 3.8 Flash. Their causes remain unknown. A separate DeepSeek attempt returned an intermediate story ledger larger than the local 24,000-character limit; the new compaction and checkpoint behavior addresses that failure path, but cannot recover the unsaved earlier response. Raw generation and chat share the host’s credential path but use different prompts and settings; the current evidence does not identify a credential, moderation, or reasoning-setting cause. This release improves the evidence available for the next reproduction and does not claim to fix the upstream behavior.

Successful end-to-end adaptation in a running Lumiverse instance with these connections remains to be verified. The interactive preview uses a mocked host and model; it cannot establish provider compatibility or adaptation quality.

Suggested first run:

1. In Lumiverse 1.2.0 or newer, open **Extensions**, install using `https://github.com/fidgetycarrot/lumiverse-set-points`, and enable **Set Points**.
2. In Review, open `examples/lighthouse-draft.json` and save it to Lumiverse. Confirm the narrator card, attached world book, and alternate greetings.
3. Open a new chat with the narrator. Check Force, immediate Undo, and independent progress in another chat.
4. Enable Follow, use a compatible chat model, and check a normal reply's handoff. Regenerate and continue must not insert a new scene.
5. Select the intended Lumiverse connection and choose **Check connection**. Record the displayed category if the neutral test fails. This uses a small billable model request without story text.
6. Try `examples/lighthouse-story.txt` or the intended adaptation separately. If it fails, record the new error code and download diagnostics immediately afterward. Confirm that response details contain only allowed codes, lengths, and numeric usage.
7. If a 0.1.3 attempt fails or is cancelled after a response was saved, reload the extension and use **Resume saved import**. Verify that matching completed requests are reused and current form edits remain intact. If the outcome is unknown, review the possible duplicate-charge warning before choosing **Retry unfinished request**.
8. If adaptation succeeds, review its cast, starting knowledge, and player agency before saving. A successful neutral check alone is not this verification.

Repository installation target: [fidgetycarrot/lumiverse-set-points](https://github.com/fidgetycarrot/lumiverse-set-points).
