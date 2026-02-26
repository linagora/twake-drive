# Project Research Summary

**Project:** Scribe — AI Writing Assistant for OnlyOffice in Cozy Drive
**Domain:** OnlyOffice plugin development + cross-iframe AI integration
**Researched:** 2026-02-26
**Confidence:** MEDIUM (core APIs verified against official docs; exact Cozy-deployed Document Server version unknown — this is the single largest variable)

## Executive Summary

Scribe is an AI writing assistant that integrates into the OnlyOffice document editor embedded within Cozy Drive. Building it requires bridging three nested iframes: the Cozy Drive React app (host), the OnlyOffice editor iframe, and an OnlyOffice plugin iframe. The recommended approach is a hybrid architecture where a minimal background OnlyOffice plugin handles document-level operations (selection detection, text extraction, text reinsertion) while all UI and AI logic lives in a React panel component in Cozy Drive's own DOM. This split is validated by a precedent already in the codebase: `OnlyOfficeAIAssistantPanel` renders alongside the editor div using the same pattern. Cross-iframe communication uses raw `window.postMessage` with typed TypeScript message schemas — no third-party abstraction library is needed or recommended.

The recommended feature set follows the industry-standard select-transform-preview-apply loop, matching what users expect from Notion AI, Google Gemini in Docs, and Copilot in Word. The MVP must deliver: selection detection via the OnlyOffice plugin, a postMessage bridge, a Scribe panel with an action menu (rewrite, grammar fix, free-form prompt), AI result preview, and text replacement/insertion back into the document. Differentiating features — editable preview before applying, privacy-first messaging, and streaming response — can be layered in during v1.x. Full document generation, autonomous agents, and multi-provider model selection are explicit anti-features.

The critical risk is threefold: (1) the exact OnlyOffice Document Server version deployed on Cozy instances is unknown, and API availability is version-sensitive — this must be resolved before any code is written; (2) selection loss when the Scribe panel receives focus will cause text replacement to fail if not explicitly handled in the POC; (3) formatting destruction during the extract-transform-reinsert cycle is expected and must be scoped as a known limitation for v1. If all three risks are validated and bounded in an early POC, the remaining development is sequential and well-precedented.

## Key Findings

### Recommended Stack

The stack requires zero new npm dependencies for the Cozy Drive side — existing React 18.2.0, TypeScript 4.9.5, cozy-ui, and cozy-client cover everything needed. The OnlyOffice plugin is vanilla JavaScript with no bundler or npm dependencies (OnlyOffice plugin constraints). Cross-iframe communication uses the native `window.postMessage` Web API. The critical architectural choice is to use the OnlyOffice Plugin SDK v1 (the only available SDK), not the Connector/Automation API which is a paid Developer-edition add-on that may not be available in Cozy's OnlyOffice deployment. Document Server 8.2.0 is the minimum supported version (it is the baseline for `attachEditorEvent`, context menu API improvements, and the official AI plugin's `minVersion`).

**Core technologies:**
- **OnlyOffice Plugin SDK v1**: Plugin runtime in the editor iframe — the only SDK version; stable across Document Server 7.x–9.x
- **`executeMethod` / `callCommand`**: Document read/write API — `executeMethod` reads (GetSelectedText, PasteText, AddContextMenuItem), `callCommand` writes structured content
- **`window.postMessage`**: Cross-iframe communication — raw Web API with typed TypeScript schemas; no library needed for ~8 message types
- **React 18.2.0 + TypeScript 4.9.5**: Scribe panel UI — existing in Cozy Drive stack, no new dependency
- **cozy-client**: AI backend calls — handles Cozy auth tokens; plugin iframe cannot authenticate directly
- **`window.top.postMessage`**: Reaching Cozy Drive from the plugin — `window.parent` points to the OO editor iframe, not Cozy Drive; must use `window.top`

### Expected Features

The feature chain has one critical dependency: everything flows from the plugin's ability to detect and read text selection. Once that works, adding new AI actions (tone, translation, length) is incremental — they differ only in the instruction sent to the backend.

**Must have (table stakes):**
- Plugin selection detection + contextual "Scribe" trigger — the entire chain depends on this; no shortcut exists
- postMessage communication protocol — the bridge enabling all other features
- Scribe action menu (rewrite, grammar fix, free-form prompt) — users expect preset actions plus an escape hatch
- AI result preview before applying — every competitor shows a preview; omitting it breaks user trust
- Replace selected text — the primary reason Scribe exists; technically the hardest step
- Insert after selection — low marginal cost once Replace works
- Accept / Reject / Regenerate cycle — users must be able to say no and retry

**Should have (competitive):**
- Editable preview before applying — no competitor allows this; it is a genuine differentiator
- Tone adjustment and Lengthen/Shorten — likely requested immediately after launch
- Translation — doubly expected for a French product serving European users
- Streaming response preview — perceived 40-60% speed improvement; Cozy Drive already has cozy-realtime for SSE
- Visual diff (original vs. AI result) — Notion does this; increases user trust significantly

**Defer (v2+):**
- Conversation memory / iterative refinement — requires session state and backend conversation support
- Self-hosted model option — high infrastructure complexity; the privacy messaging is the near-term win
- Summarize entire document — already exists as `SummarizeByAIButton` in the toolbar; duplicating it in Scribe creates confusion

**Anti-features (explicitly excluded):**
- Full document generation, autonomous agents, multi-provider model selection, real-time grammar underlining — all contradict Scribe's scope, Cozy's values, or the available API surface

### Architecture Approach

The architecture uses a hybrid pattern: the OnlyOffice plugin acts as a thin bridge (type: `background`, no visible UI inside OO) while all UI lives as a React component (`ScribePanel`) rendered as a sibling to the `#onlyOfficeEditor` div in Cozy Drive's flex container. The plugin handles only document operations; the panel handles AI calls, state, and user interaction. This pattern is already validated in the codebase by `OnlyOfficeAIAssistantPanel`. Communication between the plugin (OO Document Server origin) and the panel (Cozy Drive origin) is cross-origin and uses `window.postMessage` with strict origin validation.

**Major components:**
1. **Scribe OnlyOffice Plugin** (`scribe-plugin/`) — vanilla JS, deployed to OO Document Server; detects selection, adds context menu item, extracts text, replaces text; communicates with host via `window.top.postMessage`
2. **Scribe Panel** (`src/modules/views/OnlyOffice/Scribe/`) — React + TypeScript + cozy-ui; action menu, preview, edit-before-apply; calls AI backend via cozy-client
3. **PostMessage Bridge** (`useScribePlugin.ts` + `scribeProtocol.ts`) — typed protocol layer; validates origins, debounces selection events, dispatches commands to plugin
4. **ScribeProvider** — React context managing the selection-driven state machine (IDLE → READY → ACTION_SELECT → PROCESSING → PREVIEW → APPLYING → IDLE)
5. **Scribe AI API** — external backend; called via cozy-client from the panel; adapter layer isolates the rest of the system from API contract changes

### Critical Pitfalls

1. **OnlyOffice Document Server version unknown** — API availability is version-sensitive (`attachEditorEvent` requires 8.2+; Automation API requires Developer edition). Determine the exact deployed version before writing any code. This is a Phase 0 blocker.

2. **Selection lost when Scribe panel receives focus** — OnlyOffice clears its internal selection the moment its iframe loses focus. The plugin must capture and store the selection text AND position metadata before the Scribe panel becomes visible or interactive. Use `Asc.scope` or `ReplaceTextSmart` with the stored text as reference. This must be demonstrated in the Phase 1 POC or the entire product concept is at risk.

3. **`callCommand` context isolation silently breaks data flow** — `callCommand` executes in a completely isolated JS sandbox. No plugin variables, no async operations, no methods in objects passed via `Asc.scope`. All AI calls and data preparation must happen in the plugin's iframe context; only the final payload (primitives/simple objects) passes through `Asc.scope`.

4. **Formatting destruction during extract-transform-reinsert** — `GetSelectedText` returns plain text; `PasteHtml` has confirmed bugs (numbered lists always paste as "1.", heading hierarchy degrades); `ReplaceTextSmart` has a confirmed bug with Track Changes enabled. For v1: target Tier 1 formatting (bold, italic, font via `ReplaceTextSmart`); explicitly document that structural formatting (headings, lists) is not preserved.

5. **postMessage security with four iframe layers** — the system has four communicating origins. Never use `"*"` as `targetOrigin` in production. Use exact-match allowlists for origin validation. Validate both `event.origin` and `event.source`. Name all messages with `scribe:` prefix to avoid collisions with OnlyOffice's own postMessage traffic.

## Implications for Roadmap

Based on combined research, the phase structure is determined by hard technical dependencies and risk ordering. The plugin POC is the critical path: if it fails, the architecture must change. Everything else depends on it.

### Phase 0: Version Discovery and Environment Setup
**Rationale:** The exact OnlyOffice Document Server version deployed on Cozy instances is unknown — this is explicitly flagged in the project notes and in PITFALLS.md. Every API method used in subsequent phases has version-dependent availability. This is a blocker for Phase 1.
**Delivers:** Confirmed Document Server version number, API compatibility matrix, confirmed plugin deployment path on Cozy infrastructure, Docker dev environment with plugin mounting validated.
**Avoids:** Version mismatch pitfall (PITFALLS.md Pitfall 6) which has a HIGH recovery cost if discovered late.
**Research flag:** No `/gsd:research-phase` needed — this is pure environment discovery work, not research.

### Phase 1: OnlyOffice Plugin POC (Critical Path)
**Rationale:** The plugin is the highest-uncertainty component. If the plugin API does not work as expected with the deployed OO version — specifically if selection detection, text extraction, text reinsertion, and postMessage to `window.top` all work — the entire architecture may need rethinking. This must be validated before building anything else.
**Delivers:** Minimal working plugin demonstrating: `initOnSelectionChanged` fires, `GetSelectedText` returns text, `InputText` replaces selection, `window.top.postMessage` reaches Cozy Drive. Critically: the selection-loss-on-focus-change problem is reproduced and a mitigation strategy is validated.
**Features:** Plugin selection detection, context menu trigger (FEATURES.md P1)
**Avoids:** Selection loss pitfall (PITFALLS.md Pitfall 1), `callCommand` isolation pitfall (Pitfall 3), CSP/CORS blocking (Pitfall 5)
**Research flag:** Needs `/gsd:research-phase` — version-specific API behavior, `onExternalPluginMessage` vs. direct `window.addEventListener` reliability, selection persistence strategies.

### Phase 2: PostMessage Bridge and Protocol
**Rationale:** The bridge connects the validated plugin (Phase 1) to the host UI (Phase 3). The message schema must be defined before building the panel, or the panel will be built against a guess.
**Delivers:** `scribeProtocol.ts` with typed message schemas, `useScribePlugin.ts` hook with origin validation and selection debouncing, confirmed bidirectional communication between plugin and Cozy Drive host.
**Uses:** TypeScript 4.9.5, typed `ScribeMessage` interfaces (STACK.md), exact `targetOrigin` configuration
**Implements:** PostMessage Bridge component (ARCHITECTURE.md Phase 2)
**Avoids:** postMessage security pitfall (PITFALLS.md Pitfall 4), wildcard origin vulnerabilities
**Research flag:** Standard patterns; skip `/gsd:research-phase`.

### Phase 3: Scribe Panel UI and AI Integration
**Rationale:** The panel depends on the bridge (Phase 2) for receiving selection data and sending replacement commands. AI integration can be developed in parallel using mocks against a defined API contract, then connected when the backend is available.
**Delivers:** `ScribeProvider`, `ScribePanel`, `ScribeActionMenu`, `ScribePreview` (with editable textarea), integrated into `View.jsx` alongside `OnlyOfficeAIAssistantPanel`. AI backend calls via `useScribeAI.ts` with adapter layer isolating the API contract.
**Features:** All P1 features — action menu (rewrite, grammar fix, free-form prompt), preview, accept/reject/regenerate, replace, insert (FEATURES.md)
**Implements:** Scribe Panel component, ScribeProvider state machine (ARCHITECTURE.md Phase 3 + 4)
**Avoids:** AI API instability pitfall (build adapter layer per PITFALLS.md Integration Gotchas), plugin UI inside OnlyOffice anti-pattern
**Research flag:** Skip `/gsd:research-phase` for the React/cozy-ui panel itself (standard patterns). May need research on AI API contract if the Scribe backend specification is not yet stable.

### Phase 4: End-to-End Integration and Formatting Scope
**Rationale:** Requires all prior phases. This is where the full select → AI → preview → replace flow is assembled and the formatting preservation boundary is formally defined based on testing.
**Delivers:** Complete end-to-end flow with real AI backend. Formatting test matrix run against bold, italic, headings, lists, colored text. Formatting tier boundary documented. Context menu trigger integrated. Error recovery for network failures, AI errors, and plugin disconnects.
**Features:** Full P1 feature set complete and validated end-to-end (FEATURES.md)
**Avoids:** Formatting destruction pitfall (PITFALLS.md Pitfall 2) — tier boundary set and communicated to users, not hidden
**Research flag:** Needs `/gsd:research-phase` for formatting preservation — `ReplaceTextSmart` behavior with the specific OO version, `PasteHtml` limitations, Track Changes interaction.

### Phase 5: Polish and v1.x Feature Additions
**Rationale:** Once the core pipeline is validated stable, P2 features (tone adjustment, translation, streaming, visual diff, editable preview) can be added incrementally. Each adds only a new action type or a UI enhancement — they do not change the underlying architecture.
**Delivers:** Tone, length, translation actions. Streaming preview. Visual diff. Debounced selection button stability. Loading states. Undo integration verification. Memory leak testing over 30+ open/close cycles.
**Features:** All P2 features from FEATURES.md
**Avoids:** Performance pitfalls (unthrottled selection events, resource leaks — PITFALLS.md Performance Traps), UX pitfalls (erratic button, no loading indicator)
**Research flag:** Skip `/gsd:research-phase` — these are incremental additions to the proven pipeline.

### Phase Ordering Rationale

- **Phase 0 before Phase 1:** Version discovery is a blocker. Building against the wrong API version has a HIGH recovery cost.
- **Phase 1 before everything:** The plugin POC is the critical path. If selection detection, postMessage to `window.top`, or text reinsertion don't work, the architecture changes. Everything else is contingent.
- **Phase 2 before Phase 3:** The message schema must be defined before the panel is built. Phase 3 can mock the plugin side, but the message types must be stable.
- **Phase 3 and AI integration in parallel:** `useScribeAI.ts` can be built against a mocked API contract while the UI is developed, then connected when the real backend is available.
- **Phase 4 last for integration:** End-to-end assembly requires all components ready. The formatting tier decision is deferred here because it requires real testing with the actual OO version.
- **Phase 5 incremental:** P2 features are additions to a stable pipeline, not architectural changes. They should not block Phase 4 from being released.

### Research Flags

Needs `/gsd:research-phase` during planning:
- **Phase 1:** Version-specific plugin API behavior, `onExternalPluginMessage` vs. direct `addEventListener` reliability in the specific deployed OO version, selection persistence strategies when focus shifts to another iframe
- **Phase 4:** `ReplaceTextSmart` behavior with the target OO version, `PasteHtml` limitations for formatted content, Track Changes interaction with text replacement

Standard patterns (skip `/gsd:research-phase`):
- **Phase 2:** postMessage with TypeScript types is well-documented; origin validation is straightforward
- **Phase 3:** React panel with cozy-ui follows established patterns already in the codebase (`OnlyOfficeAIAssistantPanel` is the template)
- **Phase 5:** All P2 features are additions to a working pipeline; patterns are established by Phase 4

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core OnlyOffice Plugin SDK v1 API verified against official docs and AI plugin source code. The single gap: the exact Document Server version on Cozy instances is unknown, which affects method availability. |
| Features | MEDIUM | Industry patterns are very consistent across Notion AI, Google Gemini, Copilot, and OnlyOffice's own AI plugin — the feature set is well-established. Uncertainty is in the technical feasibility layer (what can actually be delivered given the plugin API constraints), not in what users expect. |
| Architecture | MEDIUM | The hybrid plugin + host panel architecture is confirmed by the existing `OnlyOfficeAIAssistantPanel` precedent in the codebase. The `onExternalPluginMessage` reliability is the main architectural uncertainty — it was reportedly moved to Automation API in OO 7.2+, and a fallback using direct `window.addEventListener` in the plugin may be needed. |
| Pitfalls | MEDIUM-HIGH | Most critical pitfalls are sourced from official OnlyOffice docs, official blog posts, and confirmed bug reports. The selection-loss and `callCommand` isolation pitfalls are particularly well-documented. The formatting bugs (`PasteHtml` numbered lists, `ReplaceTextSmart` + Track Changes) are confirmed by OnlyOffice themselves. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Exact Document Server version on Cozy production instances:** Must be determined before Phase 1 begins. API compatibility matrix cannot be built without it. Contact Cozy Cloud infrastructure team or check the Document Server health endpoint in the staging environment.
- **`onExternalPluginMessage` availability in target OO version:** Community reports suggest it was moved to Automation API in 7.2+. The Phase 1 POC must test both `onExternalPluginMessage` and a direct `window.addEventListener('message', ...)` fallback in the plugin, and determine which works reliably.
- **Scribe AI API contract stability:** PROJECT.md notes the API is not yet stabilized ("L'API du moteur IA Scribe n'est pas encore stabilisee"). Phase 3 must build an adapter layer to isolate this uncertainty. Coordinate with the backend team to agree on a provisional contract for development.
- **Connector/Automation API licensing:** If Cozy's OnlyOffice deployment includes Developer edition, the Automation API `createConnector()` would simplify the architecture significantly (no plugin deployment, no triple-iframe nesting). Verify the licensing tier before Phase 1. If available, the architecture in Phases 1-2 should be reconsidered.
- **CSP/CORS configuration on Cozy staging:** The production CSP headers on Cozy Drive and OnlyOffice proxy must allow the nested iframe chain. This must be tested in a staging environment that mirrors production, not just on localhost Docker.

## Sources

### Primary (HIGH confidence)
- [OnlyOffice Plugin & Macros Documentation](https://api.onlyoffice.com/docs/plugin-and-macros/get-started/) — plugin structure, config, API overview
- [OnlyOffice How to Call Methods](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-methods/) — `executeMethod` syntax
- [OnlyOffice How to Call Commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) — `callCommand` syntax, `Asc.scope`, isolation rules
- [OnlyOffice Context Menu API](https://api.onlyoffice.com/docs/plugin-and-macros/customization/context-menu/) — `AddContextMenuItem`, `onContextMenuShow`
- [OnlyOffice AI Plugin Source Code](https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/sdkjs-plugins/content/ai) — reference implementation for text selection, replacement, context menu
- [OnlyOffice Plugin API: How to call commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) — `callCommand` context isolation rules
- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) — cross-origin iframe communication
- Cozy Drive codebase: `src/modules/views/OnlyOffice/` — existing `OnlyOfficeAIAssistantPanel` pattern, `useConfig.jsx` DocsAPI integration

### Secondary (MEDIUM confidence)
- [OnlyOffice Community: Plugin-to-React postMessage](https://community.onlyoffice.com/t/how-to-send-message-from-the-plugin-to-react-app-using-iframe/14454) — `window.top.postMessage` solution for triple-iframe nesting
- [OnlyOffice Community: initOnSelectionChanged infinite loop](https://community.onlyoffice.com/t/when-the-plugin-enables-the-initonselectionchanged-configuration-executing-both-executemethod-and-callcommand-causes-an-infinite-loop-of-execution/11536) — confirmed infinite loop bug
- [OnlyOffice Community: onExternalPluginMessage deprecation in 7.2+](https://community.onlyoffice.com/t/oo-docs-7-2-onexternalpluginmessage-does-not-work/3317/8) — host-to-plugin message reliability question
- [OnlyOffice Community: ReplaceTextSmart + Track Changes bug](https://community.onlyoffice.com/t/issue-with-replacetextsmart-in-text-document-api/18486) — confirmed bug registered Feb 2026
- [OnlyOffice Community: Best Practices for Formatting After AI](https://community.onlyoffice.com/t/best-practices-for-retaining-formatting-when-pasting-ai-responses-in-onlyoffice/12811) — formatting preservation strategies
- [OnlyOffice AI Plugin Customization Guide](https://www.onlyoffice.com/blog/2025/12/how-to-add-custom-features-to-the-onlyoffice-ai-plugin) — architecture details, code patterns
- [Creating OnlyOffice plugins: tips, tricks, and hidden pitfalls (Jan 2026)](https://www.onlyoffice.com/blog/2026/01/creating-onlyoffice-plugins-tips-tricks-and-hidden-pitfalls) — callCommand isolation, scope rules
- Competitor feature analysis: Notion AI, Google Docs Gemini, Microsoft Copilot Word, Grammarly, OnlyOffice AI Plugin

### Tertiary (LOW confidence / needs validation)
- Cozy-deployed OnlyOffice Document Server version — unknown; must be discovered
- Scribe AI API contract — not yet stabilized; provisional contract needed for development
- Connector/Automation API licensing in Cozy's OO deployment — unknown; verify before Phase 1

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
