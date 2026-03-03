# Phase 2: Contextual Trigger and Communication Bridge - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire a contextual Scribe trigger button and a bidirectional communication bridge (`cozy-bridge` SDK) between the OnlyOffice plugin and Cozy Drive. The bridge uses an intent-based protocol inspired by Android intents and Cozy's existing intent system. A single intent (`AI_TEXT_EDIT`) is supported. A placeholder modal in Cozy Drive validates the full round-trip: plugin → cozy-bridge → modal → cozy-bridge → plugin → document modified.

</domain>

<decisions>
## Implementation Decisions

### Trigger Placement & Behavior
- Floating button that appears below the text selection, immediately on selection (no delay)
- Small icon button (compact, no label) — e.g. sparkle/wand icon
- Disappears when selection is cleared
- Positioned below the selected text to keep reading flow clear above

### Intent Protocol (cozy-bridge)
- SDK named `cozy-bridge` — standalone module, not embedded in Cozy Drive code
- Intent-based protocol inspired by Android intents and Cozy's existing intent system (https://docs.cozy.io/en/cozy-stack/intents/)
- Adapted for OO plugin-in-iframe context (not a direct reuse of cozy-stack intents, but same terminology and concepts)
- Generic intent system from day one — `AI_TEXT_EDIT` is the first intent, but the protocol supports future intents
- Action verb: `AI_TEXT_EDIT`
- Message structure: Claude decides the exact format, aligned with Cozy/Android conventions
- Plugin initiates: plugin detects selection + button click, casts intent with selected text
- Promise-based API: `castIntent('AI_TEXT_EDIT', { text }) → Promise<{ action, result }>`
- Acknowledgment: simple success/fail (`{ status: 'ok' }` or `{ status: 'error' }`), no detailed error payloads
- Intent ID for correlation: each intent gets a unique ID, responses are correlated by ID
- cozy-bridge validates message schema (required fields, types, size limits) before routing

### Security Model
- Origin validation via allowlist: only known origins (Cozy domain, OO server domain) accepted
- Origin determined by iframe URL, not by message payload
- Messages from unrecognized origins: ignored silently + console warning logged
- No token/nonce exchange for Phase 2 — origin check is sufficient
- Future: services declare intents they can call/handle in manifests, stack maintains capability directory (out of scope, noted for cozy-bridge generalization project)

### Cozy Drive Integration
- cozy-bridge lives as a dedicated service/module (e.g. `src/services/cozy-bridge/`), initialized at editor page load
- Decoupled from the OnlyOffice viewer component
- When intent `AI_TEXT_EDIT` is received: Cozy Drive opens a centered modal/overlay
- Modal placeholder content: displays the selected text received from plugin + Replace/Insert/Cancel buttons
- Full round-trip validated in Phase 2: buttons send commands back via cozy-bridge, plugin receives and modifies document (replace/insert text as-is, no transformation)
- Cancel closes modal without document modification

### Claude's Discretion
- Exact message format structure (aligned with Cozy/Android intent conventions)
- Whether to integrate with or build alongside existing Cozy postMessage mechanisms (evaluate during research)
- Icon choice for the floating trigger button
- Exact positioning logic for the floating button within OO editor constraints
- Modal styling and layout details

</decisions>

<specifics>
## Specific Ideas

- "Il faut reprendre la terminologie des intents qui sont castés par le service, reçu pour traitement par l'application Cozy" — Android intent model adapted to Cozy web context
- cozy-bridge should be designed so future intents from other services (not just OO plugins) can use the same mechanism
- Reference: Cozy's existing intent documentation at https://docs.cozy.io/en/cozy-stack/intents/
- The protocol should feel familiar to someone who knows Android's intent system (action, type, data, resolve)

</specifics>

<deferred>
## Deferred Ideas

- Intent capability directory in cozy-stack: services declare intents they call, capabilities they expose, stack maintains an annuaire — belongs in a cozy-bridge generalization project
- Nonce/token handshake authentication for inter-service trust — future security hardening
- Multiple capabilities per intent with user choice (like Android's app chooser) — future cozy-bridge feature
- Promise wrapper as syntactic sugar over postMessage — could be added to cozy-bridge later if many intents exist

</deferred>

---

*Phase: 02-contextual-trigger-and-communication-bridge*
*Context gathered: 2026-02-28*
