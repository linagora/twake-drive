# Pitfalls Research

**Domain:** OnlyOffice plugin development with cross-iframe AI integration (Scribe for Cozy Drive)
**Researched:** 2026-02-26
**Confidence:** MEDIUM-HIGH (primary sources from OnlyOffice official docs and community; some areas have limited documentation)

## Critical Pitfalls

### Pitfall 1: Selection Lost When Scribe Iframe Receives Focus

**What goes wrong:**
When the user clicks inside the Scribe overlay iframe (to choose an AI action, edit text, etc.), the browser transfers focus away from the OnlyOffice editor iframe. OnlyOffice clears or loses the internal text selection the moment its iframe loses focus. When Scribe sends the modified text back to the plugin for reinsertion, the original selection range is gone, and the plugin cannot determine where to replace content.

**Why it happens:**
OnlyOffice renders its document on a `<canvas>` element and maintains its own internal selection model that is not the browser's native `Selection` API. This internal selection is tightly coupled to the editor's focus state. Iframes are separate browsing contexts; when one gains focus, the other loses it. The OnlyOffice editor interprets this as the user deselecting text.

**How to avoid:**
- Capture and store the selected text AND its position/range information (via `GetSelectedText` or `initDataType: "html"` with `initOnSelectionChanged: true`) **before** the Scribe iframe becomes visible or receives focus.
- Store the selection data in the plugin's JavaScript context (not in the DOM or in Scribe's iframe context). Use `Asc.scope` or a message-passing protocol to hold the selection snapshot.
- For reinsertion, do not rely on "replace current selection" -- instead, use `ReplaceTextSmart` with the stored text as a reference, or use a search-and-replace strategy (`SearchAndReplace` executeMethod) when the original selection context is lost.
- Consider using the Automation API `createConnector` approach (if licensing permits) which allows the parent page (Cozy Drive) to call `GetSelectedText` before opening Scribe, completely decoupling selection capture from Scribe's lifecycle.

**Warning signs:**
- Text replacement inserts at the cursor position instead of replacing the selected range.
- "Replace" action works in testing when Scribe is not yet focused, but fails once the user interacts with the Scribe UI.
- Inconsistent behavior between Fast and Strict co-editing modes.

**Phase to address:**
Phase 1 (POC) -- this is the single most important thing to validate. If selection persistence cannot be solved, the entire product concept is at risk. The POC must demonstrate: select text -> open Scribe -> interact with Scribe -> replace text at original location.

---

### Pitfall 2: Formatting Destruction During Extract-Transform-Reinsert Cycle

**What goes wrong:**
The user selects formatted text (bold, headings, lists, font sizes, colors). The plugin extracts it, sends it to the AI, gets a modified version back, and reinserts it. The result loses all formatting: headings become plain text, lists lose bullet points, bold/italic disappears, font sizes and families change.

**Why it happens:**
Three failure points compound:

1. **Extraction loss:** `GetSelectedText` returns plain text by default. Even with `initDataType: "html"`, the HTML representation does not capture all OnlyOffice internal formatting (graphic objects, formulas, drop caps, content controls, footnotes, bookmarks, and tables are stripped -- this is documented).
2. **AI transformation loss:** The AI model receives plain text or simplified HTML and returns Markdown or restructured HTML. The AI has no concept of the original OnlyOffice formatting model.
3. **Reinsertion loss:** `PasteHtml` has confirmed bugs with numbered lists (internal defect #79263 -- all items paste as "item 1"), heading hierarchy degradation (h2/h3/h4 tags fail to convert properly), and unpredictable font family/color alterations. `PasteText` inserts plain text only. `ReplaceTextSmart` preserves formatting of the **target** paragraph while replacing text, but has a confirmed bug when Track Changes is enabled (characters merge instead of replacing -- bug registered Feb 2026, no fix timeline).

**How to avoid:**
- **Scope the formatting promise realistically for v1.** Do NOT promise full formatting preservation. Instead, define explicit tiers:
  - Tier 1 (v1 target): Preserve paragraph-level formatting (bold, italic, font). Use `ReplaceTextSmart` which replaces text while keeping the paragraph's style.
  - Tier 2 (future): Preserve structural formatting (headings, lists). Requires `PasteHtml` with tested HTML templates.
  - Tier 3 (may never): Preserve complex objects (tables, footnotes, images). Likely requires Document Builder API.
- For Tier 1: Extract with `initDataType: "html"` to capture formatting metadata, but send only plain text to the AI. On return, use `ReplaceTextSmart` to swap text content while preserving the original paragraph formatting.
- Build a formatting-loss test matrix early: create a test document with bold, italic, headings, lists, tables, colored text, and run the full cycle to see what survives.
- The "markdowntohtml" sample plugin from OnlyOffice is the closest reference implementation for HTML insertion patterns.

**Warning signs:**
- "It works" in demos with simple plain text, but fails with real documents.
- Users report "the formatting is wrong" without specifics -- need structured testing.
- Numbered lists always show "1." after reinsertion.

**Phase to address:**
Phase 1 (POC) must define the formatting tier boundary. Phase 2 (integration) must implement the chosen tier with regression tests.

---

### Pitfall 3: callCommand Execution Context Isolation Breaks Data Flow

**What goes wrong:**
Developers write `callCommand` functions that reference variables from the plugin's outer scope, try to pass callback functions through `Asc.scope`, or attempt async operations (fetch, setTimeout) inside the command function. The command silently fails, returns `undefined`, or freezes the editor.

**Why it happens:**
`callCommand` executes its function argument in a **completely isolated context** -- a separate JavaScript sandbox within the editor's internal engine. This is not the same as the plugin's iframe JavaScript context. Key restrictions:
- No access to plugin variables, DOM, or global state.
- Functions cannot be passed through `Asc.scope` (only JSON-serializable data).
- Objects passed via `Asc.scope` are serialized; any object with methods, prototypes, or circular references will be replaced with `undefined`.
- Async operations (network requests, timers) inside `callCommand` freeze the editor thread.
- The callback receives only JS standard types; any objects returned are replaced with `undefined`.

**How to avoid:**
- Treat `callCommand` as a pure, synchronous function that receives data only through `Asc.scope` and returns only primitives/simple objects.
- Do ALL data preparation (AI API calls, text processing, formatting analysis) in the plugin's iframe context BEFORE calling `callCommand`.
- Pass only the final, minimal payload through `Asc.scope`: the replacement text string, insertion position data, and formatting instructions.
- Test `callCommand` functions in isolation by logging `Asc.scope` contents inside the command and verifying the callback output.

**Warning signs:**
- `callCommand` callback receives `undefined` unexpectedly.
- Editor freezes or becomes unresponsive after a plugin action.
- "Works in the console but not in the plugin" -- scope confusion.

**Phase to address:**
Phase 1 (POC) -- the developer must internalize this mental model before writing any document manipulation code.

---

### Pitfall 4: postMessage Origin Validation Failures and Security Holes

**What goes wrong:**
The system has 4 layers communicating across iframe boundaries: Cozy Drive (host) <-> OnlyOffice iframe <-> Plugin iframe <-> Scribe iframe. Developers use `postMessage` with wildcard `"*"` as `targetOrigin` during development, forget to restrict it for production, or implement origin validation using `includes()` / `startsWith()` which can be bypassed (e.g., `evil-cozy.example.com` passes a check for `cozy.example.com`).

**Why it happens:**
- During development, all services run on `localhost` with different ports, making strict origin checks painful.
- The OnlyOffice Document Server runs on a separate Docker container with its own origin (different host/port from Cozy Drive).
- Plugin iframes have their origin set by the Document Server, not by Cozy Drive.
- Scribe iframe's origin depends on whether it's served from the same Cozy Drive origin or a separate service.
- Developers use substring matching instead of exact origin comparison.

**How to avoid:**
- Define an explicit origin allowlist as a configuration constant, not hardcoded:
  ```javascript
  const ALLOWED_ORIGINS = [
    'https://drive.cozy.example.com',
    'https://office.cozy.example.com'
  ];
  ```
- Always use **exact match** against `event.origin` (strict equality with the allowlist, no substring/regex).
- Always specify the exact `targetOrigin` when calling `postMessage()` -- never `"*"` except for truly public broadcasts.
- Validate `event.source` in addition to `event.origin` to prevent null-origin attacks (deleted iframes can send messages with `null` source).
- Define a structured message protocol with a `type` field and validate message shape before processing.
- Use a shared message schema between sender and receiver (TypeScript interface enforced at both ends).

**Warning signs:**
- Using `"*"` as targetOrigin anywhere in production code.
- Origin validation using `includes()`, `startsWith()`, or regex.
- No `event.source` validation.
- Messages work in development but silently fail in production (different origins).

**Phase to address:**
Phase 2 (integration) must define the message protocol and security model. Phase 1 (POC) can use `"*"` for speed but must flag every instance as `// TODO: restrict origin`.

---

### Pitfall 5: CSP and CORS Triple-Iframe Blocking

**What goes wrong:**
The browser blocks loading or communication between the nested iframes. Cozy Drive cannot embed the OnlyOffice iframe, or the OnlyOffice editor cannot load the plugin, or the Scribe iframe cannot communicate with its parent. Errors appear as "Refused to frame" in the console, or resources silently fail to load.

**Why it happens:**
The architecture involves multiple origins:
- **Cozy Drive** (`https://drive.cozy.example.com`) hosts the page.
- **OnlyOffice Document Server** (`https://office.cozy.example.com`) serves the editor iframe and the plugin iframe.
- **Scribe iframe** (origin TBD -- either same as Cozy Drive or a separate service).

Each origin can set its own `Content-Security-Policy` headers:
- `frame-src` on Cozy Drive must allow the OnlyOffice origin.
- `frame-ancestors` on OnlyOffice must allow being embedded by Cozy Drive.
- The plugin's resources must be served with CORS headers if loaded cross-origin.
- Mixed HTTP/HTTPS causes silent failures -- OnlyOffice Docker behind a reverse proxy often generates HTTP URLs internally even when accessed via HTTPS (documented issue).

**How to avoid:**
- Map all origins in the architecture early (Phase 1). Document: "Origin A embeds origin B, which embeds origin C. A sends messages to B and C."
- Configure the OnlyOffice Document Server's nginx proxy to properly set `X-Forwarded-Proto` and `X-Forwarded-Host` headers so it generates HTTPS URLs.
- Set `frame-ancestors` on the OnlyOffice Document Server to include the Cozy Drive origin.
- Set `frame-src` on Cozy Drive to include the OnlyOffice origin.
- For the plugin: ensure it is served from the Document Server's origin (plugins are loaded by the editor, not by the parent page), so same-origin policy applies.
- For the Scribe iframe: if served from Cozy Drive's origin, no extra CORS needed for Cozy Drive <-> Scribe communication. If served from a different origin, add appropriate `frame-ancestors` and CORS headers.
- Test in production-like configuration early (not just localhost).

**Warning signs:**
- "Refused to frame" errors in browser console.
- Blank iframes or infinite loading spinners.
- Plugin works in development (same localhost) but fails in staging/production.
- WebSocket connection failures (OnlyOffice uses WebSocket for real-time sync; CORS/proxy misconfiguration breaks this).

**Phase to address:**
Phase 1 (POC) must validate the full iframe nesting chain works in the Docker development environment. Phase 2 (integration) must document and test the production CSP/CORS configuration.

---

### Pitfall 6: OnlyOffice Document Server Version Mismatch

**What goes wrong:**
The plugin uses API methods (`executeMethod`, event names, configuration parameters) that do not exist in the version of OnlyOffice Document Server deployed on the Cozy instance. The plugin silently fails, throws `undefined is not a function`, or the editor ignores the plugin entirely.

**Why it happens:**
- The PROJECT.md explicitly states: "La version exacte de OnlyOffice n'est pas connue."
- OnlyOffice API evolves significantly between versions. Examples:
  - `attachEditorEvent` was introduced in version 8.2.
  - Plugin `type` parameter (`panel`, `panelRight`, `system`, etc.) replaced deprecated `isVisual`, `isModal`, `isInsideMode` parameters.
  - The Automation API `createConnector` is only available in the Developer edition (paid extra).
  - The sockjs-to-socket.io migration changed real-time communication internals.
- Plugin `config.json` fields vary by version; older servers ignore unknown fields but reject missing required ones.

**How to avoid:**
- **Determine the exact Document Server version deployed on Cozy instances before writing any code.** This is prerequisite #1 for the entire project.
- Check the version via the Document Server health endpoint or configuration.
- Cross-reference every API method used against the version's changelog.
- Build a compatibility matrix: "Feature X requires version Y+."
- Use feature detection in the plugin (`if (typeof Asc.plugin.executeMethod === 'function')`) rather than assuming method availability.
- If the Cozy-deployed version is old, plan for API workarounds or coordinate a Document Server upgrade.

**Warning signs:**
- Plugin loads but buttons/features do nothing.
- `TypeError: ... is not a function` in the plugin iframe's console.
- Different behavior between local Docker (latest version) and production Cozy instance (possibly older version).

**Phase to address:**
Phase 0 (pre-POC) -- version discovery must happen before any development begins. Block POC kickoff on this.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `"*"` as postMessage targetOrigin | Fast development, no origin configuration needed | Security vulnerability: any page can inject messages | POC only, with every instance marked as `// TODO: restrict origin` |
| Plain text only (no formatting preservation) | Dramatically simpler extraction/reinsertion cycle | Users expect formatting to survive; feels broken without it | v1 MVP if clearly communicated as a known limitation with a roadmap for improvement |
| Storing selection as text string (not range/position) | Simple data model, easy to pass around | Cannot determine WHERE to reinsert if selection is lost; falls back to cursor position | Never -- always capture position metadata alongside text |
| Hardcoding OnlyOffice server URL | No configuration system needed | Breaks when Document Server URL changes between environments | Never -- use environment configuration from Cozy stack (`/office/{id}/open` response already provides the URL) |
| Skipping `callCommand` callback validation | Faster iteration, assume commands succeed | Silent failures when document manipulation fails; corrupted documents | POC only, must add error handling in Phase 2 |
| Bundling Scribe UI directly in Cozy Drive repo | Avoids separate build/deploy pipeline | Tight coupling, harder to extract later, increases Cozy Drive bundle size | Acceptable for v1 per PROJECT.md decision, but structure code for future extraction |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OnlyOffice Plugin <-> Editor | Attempting async operations (fetch, setTimeout) inside `callCommand` | Do all async work in plugin iframe, pass only final data via `Asc.scope`, then call `callCommand` synchronously |
| Plugin <-> Scribe iframe | Sending messages without a structured protocol (just raw strings) | Define a typed message protocol: `{ type: 'SCRIBE_REQUEST', payload: { text, action, format } }` with version field for future compatibility |
| Cozy Drive <-> AI Backend | Calling the AI API directly from the plugin iframe | Route AI calls through the Scribe iframe (which is in Cozy Drive's origin and has access to cozy-client auth tokens). The plugin iframe (OnlyOffice origin) cannot authenticate against Cozy stack APIs. |
| OnlyOffice Editor <-> Selection Events | Polling for selection changes | Use `initOnSelectionChanged: true` in plugin config.json to get push-based selection events. Still debounce the handler (selection events fire on every cursor movement, not just text selections). |
| Scribe iframe <-> Cozy Stack (AI API) | Assuming the AI API contract is stable | PROJECT.md says "L'API du moteur IA Scribe n'est pas encore stabilisee." Build an adapter layer in Scribe that isolates the rest of the system from API changes. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unthrottled `onSelectionChanged` events | UI jank, high CPU usage, button flickering as it appears/disappears on every cursor movement | Debounce selection change handler (300-500ms). Only show the Scribe button when selection contains actual text (length > 0), not on every cursor position change. | Immediately noticeable in any document with frequent cursor movement |
| Large document text extraction | Editor freezes for seconds when extracting text from a long selection (10+ pages) | Limit selection size with a user-friendly message ("Selection too long for AI processing -- max 5000 characters"). Validate size before sending to AI. | Documents with 50+ page selections, though users may try to "rewrite my entire document" |
| Plugin resource leaks on repeated open/close | Memory growth, degraded editor performance over time, eventual tab crash | Clear all timers, abort in-flight requests, remove event listeners in `window.Asc.plugin.event_onClose` or equivalent cleanup handler. Scribe iframe should also be destroyed (not just hidden) when closed. | After 20-30 open/close cycles in a single editing session |
| Synchronous document recalculation after every insertion | Editor becomes unresponsive during text replacement | Set `isCalc: false` on `callCommand` when making multiple sequential edits, then trigger a single recalculation at the end. Or batch insertions into a single `callCommand` call. | Noticeable with any insertion that triggers layout reflow (headings, lists) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No message origin validation on `message` event listener | Any page in any tab can send crafted messages to inject text into the document or exfiltrate document content | Validate `event.origin` against an explicit allowlist using strict equality. Validate `event.source` is not null. |
| Passing document content through postMessage with `targetOrigin: "*"` | Document content (potentially sensitive/confidential) can be intercepted by any window/iframe on the page | Always specify the exact target origin when sending document text. |
| Injecting AI-returned text directly into document without sanitization | AI response could contain HTML/script injection if using `PasteHtml`, or could be manipulated by prompt injection to include malicious content | Sanitize AI responses before insertion. For `PasteHtml`, use a whitelist of allowed HTML tags/attributes. For `ReplaceTextSmart`, plain text is inherently safer. |
| Plugin GUID reuse or predictable GUIDs | Attacker could register a malicious plugin with the same GUID, replacing the legitimate one during updates | Generate a unique, stable GUID for the Scribe plugin at project start. Use a UUID v4. Never change it after initial deployment. |
| Loading external resources (CDN scripts/styles) in plugin | Supply chain attack vector; external CDN compromise affects all users | Bundle all plugin dependencies locally. No external script/style references in plugin HTML. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Scribe button appears/disappears erratically during selection | User cannot click the button because it keeps vanishing as the selection updates | Debounce button visibility (show after selection stabilizes for 300ms). Once shown, keep visible until selection is explicitly cleared. |
| No loading indicator during AI processing | User thinks the feature is broken and clicks "Replace" multiple times, or closes Scribe | Show a clear loading state with estimated wait time. Disable action buttons during processing. Consider streaming the AI response for perceived speed. |
| Scribe overlay covers the selected text | User cannot see what they selected while choosing an AI action | Position Scribe panel to the side (right panel) or below the selection, not overlapping it. Use the OnlyOffice `panelRight` plugin type if possible, or position the Cozy Drive overlay carefully. |
| Formatting visibly changes on "Replace" | User expected formatting to be preserved; feels like the feature damaged their document | Always show a diff/preview highlighting what will change. If formatting will be lost, warn explicitly: "Formatting may change. Only text content will be preserved." Provide undo guidance. |
| "Replace" has no undo | User accidentally replaces important text with an AI suggestion they did not intend to accept | Ensure OnlyOffice's native Ctrl+Z undo works after plugin text replacement (it should, since `callCommand` operations are part of the undo stack -- but verify in POC). Display an undo hint after replacement. |

## "Looks Done But Isn't" Checklist

- [ ] **Text replacement:** Works with single paragraph -- verify multi-paragraph selections preserve paragraph breaks and individual paragraph formatting.
- [ ] **Selection capture:** Works when Scribe opens immediately -- verify it works when user selects text, waits 10 seconds, then clicks Scribe button (selection may have been modified).
- [ ] **postMessage protocol:** Works in development -- verify origin validation works in staging with real Cozy instance URLs (not localhost).
- [ ] **Plugin loading:** Works in local Docker -- verify plugin loads on the production Cozy OnlyOffice instance (different version, different CSP headers).
- [ ] **AI response handling:** Works with English text -- verify with French text, special characters (accents, ligatures), and RTL text if applicable.
- [ ] **Formatting preservation:** Works with bold/italic -- verify with heading hierarchies, numbered lists, nested lists, colored text, and mixed formatting within a single selection.
- [ ] **Concurrent editing:** Works solo -- verify behavior when another user is editing the same document in Fast co-editing mode (selection position may shift due to other user's edits).
- [ ] **Error recovery:** Happy path works -- verify behavior when AI API returns an error, when AI returns empty string, when AI returns unexpectedly long text, when network drops mid-request.
- [ ] **Resource cleanup:** Single use works -- verify no memory leaks after 30+ Scribe open/close cycles by checking browser DevTools memory timeline.
- [ ] **Undo integration:** Replacement works -- verify Ctrl+Z after replacement restores original text with original formatting.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Selection lost on focus change | MEDIUM | Redesign to capture selection before Scribe opens. Requires changing the interaction flow: button click stores selection, then Scribe opens. |
| Formatting destroyed on reinsertion | HIGH | Must choose a different API method or accept reduced formatting scope. May require rebuilding the reinsertion logic entirely. |
| callCommand data isolation bugs | LOW | Refactor to move all logic to plugin iframe, pass only primitives through Asc.scope. Usually fixable without architecture changes. |
| postMessage security holes | LOW | Add origin validation as a wrapper function around all message handlers. Can be done as a focused security pass. |
| CSP/CORS blocking in production | MEDIUM | Requires coordinated header changes on Cozy stack, OnlyOffice proxy, and potentially Scribe service. May need ops team involvement. |
| Version mismatch with production server | HIGH | May require rewriting plugin code to use older API, or coordinating a Document Server upgrade across all Cozy instances. |
| PasteHtml numbered list bug (#79263) | MEDIUM | Workaround: avoid numbered lists in v1, or use `callCommand` with Document Builder API to construct list items manually. Monitor OnlyOffice releases for the fix. |
| ReplaceTextSmart + Track Changes bug | MEDIUM | Workaround: detect if Track Changes is enabled and warn the user, or disable Track Changes programmatically before replacement and re-enable after. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OnlyOffice version unknown | Phase 0 (pre-POC) | Version number documented, API compatibility matrix created |
| Selection lost on iframe focus change | Phase 1 (POC) | Demo: select text -> open Scribe -> interact -> replace at correct position |
| Formatting destruction cycle | Phase 1 (POC) | Formatting tier defined, test matrix run, known limitations documented |
| callCommand context isolation | Phase 1 (POC) | Developer demonstrates understanding by successfully passing data through Asc.scope |
| CSP/CORS iframe chain | Phase 1 (POC) | All three iframe levels load successfully in Docker dev environment |
| postMessage security | Phase 2 (integration) | All `"*"` targetOrigins replaced with explicit origins, origin validation in all handlers |
| Plugin version compatibility | Phase 2 (integration) | Feature detection implemented, tested against target production version |
| Performance (selection events, resource leaks) | Phase 3 (polish) | Debouncing verified, memory profile shows no growth over 30 open/close cycles |
| UX (button stability, loading states, undo) | Phase 3 (polish) | User testing confirms interactions feel responsive and predictable |
| AI API instability | Phase 2 (integration) | Adapter layer isolates AI API contract; API changes require only adapter updates |

## Sources

- [Creating OnlyOffice plugins: tips, tricks, and hidden pitfalls (Jan 2026)](https://www.onlyoffice.com/blog/2026/01/creating-onlyoffice-plugins-tips-tricks-and-hidden-pitfalls) -- HIGH confidence
- [OnlyOffice Plugin API: How to call commands](https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/overview/how-to-call-commands/) -- HIGH confidence
- [OnlyOffice Automation API documentation](https://api.onlyoffice.com/docs/docs-api/usage-api/automation-api/) -- HIGH confidence
- [OnlyOffice Plugin Configuration](https://api.onlyoffice.com/docs/plugin-and-macros/structure/configuration/) -- HIGH confidence
- [Community: Best Practices for Retaining Formatting When Pasting AI Responses](https://community.onlyoffice.com/t/best-practices-for-retaining-formatting-when-pasting-ai-responses-in-onlyoffice/12811) -- MEDIUM confidence
- [Community: GetSelectedText HTML Format](https://community.onlyoffice.com/t/getselectedtext-html-format-paste-via-context-menu/8733) -- MEDIUM confidence
- [Community: ReplaceTextSmart issue with Track Changes](https://community.onlyoffice.com/t/issue-with-replacetextsmart-in-text-document-api/18486) -- HIGH confidence (bug confirmed by OnlyOffice)
- [Community: Getting selection text from OnlyOffice iframe](https://community.onlyoffice.com/t/is-there-a-way-to-get-selection-text-from-inside-the-onlyoffice-iframe/11944) -- MEDIUM confidence
- [MDN: postMessage security](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) -- HIGH confidence
- [MDN: Structured Clone Algorithm limitations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) -- HIGH confidence
- [GitHub: CSP frame-src issue with OnlyOffice+Nextcloud](https://github.com/ONLYOFFICE/onlyoffice-nextcloud/issues/54) -- MEDIUM confidence
- [Debugging OnlyOffice plugins (Nov 2025)](https://www.onlyoffice.com/blog/2025/11/debugging-onlyoffice-plugins-practical-guide) -- HIGH confidence
- Cozy Drive codebase: `src/modules/views/OnlyOffice/` -- direct code analysis

---
*Pitfalls research for: Scribe OnlyOffice plugin + cross-iframe AI integration*
*Researched: 2026-02-26*
