# Set Points 0.1.0 — verification

Prepared October 8, 2026.

## Verified

- TypeScript check completed successfully.
- 67 automated tests passed across six test files (270 assertions).
- Backend and frontend production bundles built successfully with Bun 1.4.2.
- Production dependency audit reported no known vulnerabilities at build time.
- The Lumiverse 1.2.0 backend capability scanner accepted the compiled backend with the declared `base64_decode` capability; no other blocked capabilities were reported.
- API integration was checked against Lumiverse 1.2.0 and current host source. Tests include the released host's interceptor fields and saved-message generation flow.
- The browser preview was visually inspected in dark and light themes. Its mocked Force and Undo controls updated the displayed scene state.
- The included sample draft passes the production draft validator.

Automated coverage includes source parsing and length limits; character/scene schema validation; long-source merging; model refusals, truncation, cancellation, and format repair; per-user draft isolation; interrupted card saves; permission changes; scene handoff identity; duplicate and stale event handling; Undo restrictions; and preservation of unsaved review edits.

## Still to verify in a live installation

This build has not been installed in a running Lumiverse instance or exercised with a real model connection. The interactive preview uses a mocked host and model; it cannot establish installation success, provider compatibility, or adaptation quality.

Suggested first run:

1. In Lumiverse 1.2.0 or newer, open **Extensions**, install using `https://github.com/fidgetycarrot/lumiverse-set-points`, and enable **Set Points**.
2. In Review, open `examples/lighthouse-draft.json` and save it to Lumiverse. Confirm the narrator card, attached world book, and alternate greetings.
3. Open a new chat with the narrator. Check Force, immediate Undo, and independent progress in another chat.
4. Enable Follow, use a compatible chat model, and check a normal reply's handoff. Regenerate and continue must not insert a new scene.
5. Import `examples/lighthouse-story.txt` using a chosen model connection. Review its cast, starting knowledge, and player agency before saving.

Repository installation target: [fidgetycarrot/lumiverse-set-points](https://github.com/fidgetycarrot/lumiverse-set-points).
