# Set Points 0.1.1 — verification

Prepared October 8, 2026.

## Verified

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

Automated coverage includes source parsing and length limits; character/scene schema validation; long-source merging; model refusals, truncation, cancellation, and format repair; per-user draft isolation; interrupted card saves; permission changes; scene handoff identity; duplicate and stale event handling; Undo restrictions; and preservation of unsaved review edits. Multi-page coverage checks ordered collection, exact source attribution, explicit application, partial failures, caps, duplicate pages, same-site boundaries, and cancellation with late responses.

## Still to verify in a live installation

The 0.1.0 release was used for a single-page URL import by the user. Independent end-to-end verification of this update in a running Lumiverse instance with a real model connection remains outstanding. The interactive preview uses a mocked host and model; it cannot establish installation success, provider compatibility, or adaptation quality.

Suggested first run:

1. In Lumiverse 1.2.0 or newer, open **Extensions**, install using `https://github.com/fidgetycarrot/lumiverse-set-points`, and enable **Set Points**.
2. In Review, open `examples/lighthouse-draft.json` and save it to Lumiverse. Confirm the narrator card, attached world book, and alternate greetings.
3. Open a new chat with the narrator. Check Force, immediate Undo, and independent progress in another chat.
4. Enable Follow, use a compatible chat model, and check a normal reply's handoff. Regenerate and continue must not insert a new scene.
5. Import `examples/lighthouse-story.txt` using a chosen model connection. Review its cast, starting knowledge, and player agency before saving.

Repository installation target: [fidgetycarrot/lumiverse-set-points](https://github.com/fidgetycarrot/lumiverse-set-points).
