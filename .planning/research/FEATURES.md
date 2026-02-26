# Feature Research

**Domain:** AI writing assistant integrated into OnlyOffice within Cozy Drive
**Researched:** 2026-02-26
**Confidence:** MEDIUM -- based on competitor analysis of Notion AI, Google Docs Gemini, Microsoft Copilot Word, Grammarly, and OnlyOffice's own AI plugin. Interaction patterns are well-established across the industry, but the specific constraints of the OnlyOffice plugin architecture and the Cozy Drive iframe-within-iframe setup add uncertainty.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when they see an "AI writing assistant" in a document editor. Missing these means the product feels broken or toy-like.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Text rewriting/rephrasing** | Every competitor offers this (Notion AI "Improve writing", Google "Rephrase", Copilot "Rewrite"). It is the single most common AI writing action. | LOW | Core action: select text, get rewritten version, preview, accept/reject. Already defined in PROJECT.md requirements. |
| **Tone adjustment** | Google Docs offers Formal/Casual, Grammarly offers tone rewriting, Notion AI offers "Change tone". Users expect to shift tone without rewriting manually. | LOW | Variant of rewrite with a tone parameter. Can share the same UI flow as rewrite with a dropdown for tone selection (formal, casual, professional, friendly). |
| **Grammar and spelling correction** | Grammarly's entire business is built on this. Google, Notion, OnlyOffice AI plugin all offer it. Users expect AI to catch what spellcheck misses. | LOW | Simpler than rewrite -- less ambiguity in output. Can be a single-click action. |
| **Translation** | Notion AI, Google Docs, Grammarly (5 languages), OnlyOffice AI plugin all offer inline translation. A French product (Cozy Cloud) serving European users makes this doubly expected. | MEDIUM | Requires language selection UI. The Scribe backend must support the target languages. Preserving formatting during translation is harder than for same-language rewrites. |
| **Text lengthening / shortening** | Google "Elaborate"/"Shorten", Notion "Make longer"/"Make shorter", Copilot "Make it more concise". Standard text manipulation. | LOW | Variant of rewrite with a length parameter. Same UI flow, different instruction to the AI. |
| **Preview before applying** | Every competitor shows the AI result before committing it to the document. Copilot has Keep/Regenerate/Discard. Google has Replace/Insert/Close. This is a trust mechanism. | MEDIUM | Already defined in PROJECT.md. Critical for user trust. Must show the diff clearly (Notion grays out deletions, highlights additions in blue). |
| **Accept / Reject / Regenerate cycle** | Copilot: Keep it / Regenerate / Discard / Fine-tune. Google: Replace / Insert / Close. Notion: iterative "Try again". Users expect to be able to reject and try again without losing their original text. | MEDIUM | The accept/reject flow is the core interaction loop. Must be rock-solid. "Regenerate" means re-calling the API with the same or slightly modified prompt. |
| **Free-form prompt (custom instruction)** | Notion AI "Ask AI", Google "Custom" refinement, Copilot natural language prompts, OnlyOffice AI agent Ctrl+/ chat. Users expect to give arbitrary instructions beyond preset actions. | MEDIUM | This is the escape hatch when preset actions don't fit. Requires a text input field in the Scribe UI. More complex than preset actions because the user prompt must be combined with the selected text. |
| **Replace selected text** | Google "Replace", Copilot "Keep it", OnlyOffice "Replace original text". The primary action: swap old text for new. | HIGH | High complexity not because the concept is hard, but because this requires the full OnlyOffice plugin pipeline: read selection, send to AI, receive result, write back to document, preserve formatting. This is the riskiest technical path (see PROJECT.md). |
| **Insert after selection** | Google "Insert", OnlyOffice "Insert result". Secondary action: add AI text without removing the original. | MEDIUM | Requires the plugin to position the cursor after the selection and insert. Simpler than replace (no need to delete original) but still involves document manipulation. |

### Differentiators (Competitive Advantage)

Features that set Scribe apart. Not required for launch, but provide real competitive value given Cozy Cloud's positioning as a privacy-first, user-sovereign platform.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Privacy-first AI processing** | Cozy Cloud's entire brand is data sovereignty (French hosting, GDPR, open source, user-owned data). If Scribe can communicate that text never leaves the user's Cozy instance (or at minimum, is processed by a controlled backend), this is a massive differentiator vs. Notion/Google/Microsoft who send text to their clouds. | LOW (messaging) / HIGH (if self-hosted LLM) | For v1, this is a messaging/trust differentiator. The Scribe backend API already exists and is controlled by Cozy. Future: self-hosted models (like Nextcloud's approach with Ollama). |
| **Contextual trigger at selection** | OnlyOffice's built-in AI requires Ctrl+/ or navigating to the Plugin tab. Google shows a floating pencil icon. Notion requires "Ask AI" or /AI command. A contextual button appearing right at the text selection (like Scribe's planned design) is more discoverable and lower friction than keyboard shortcuts or toolbar buttons. | MEDIUM | Already in PROJECT.md requirements. The "Scribe" button appearing at the end of the selection is a better UX than competitors' approaches if executed well. Risk: OnlyOffice plugin API may not support custom floating UI at selection position. |
| **Streaming response preview** | Users perceive streaming responses as 40-60% faster than equivalent non-streaming responses. Showing the AI "typing" the result in real-time (like ChatGPT) rather than a spinner-then-result creates a feeling of co-writing. | MEDIUM | Depends on Scribe backend supporting SSE/streaming. The iframe Scribe UI would render tokens as they arrive. Not table stakes (Google Docs does not stream inline), but a quality differentiator. |
| **Editable preview before applying** | PROJECT.md specifies "L'utilisateur peut modifier le texte propose avant de l'appliquer." Most competitors show read-only previews (accept or reject, but not edit). Allowing the user to tweak the AI output before applying it is genuinely better. | MEDIUM | Already in PROJECT.md. This is a meaningful UX advantage. Implementation: a contenteditable area in the Scribe iframe showing the AI result. |
| **Visual diff between original and AI result** | Notion shows gray (deleted) and blue (added) text. Most competitors just show the new text. Showing a clear visual diff helps users understand exactly what changed. | MEDIUM | Can be implemented in the Scribe iframe UI with a simple diff algorithm (e.g., diff-match-patch library). Not required for v1 but significantly improves trust. |
| **Conversation/iteration memory** | OnlyOffice's AI agent maintains conversation context. Grammarly's agents remember prior interactions. Allowing the user to refine iteratively ("make it shorter", "now more formal", "actually, keep the first paragraph") without re-selecting text each time. | HIGH | Requires maintaining session state in the Scribe iframe across multiple AI calls. The backend API must support conversation context or the frontend must send prior exchanges. Defer to v1.x. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create problems in the Scribe context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full document generation from scratch** | Copilot and Notion AI can generate entire documents from a prompt. Seems powerful. | Completely different UX from the select-text-and-transform paradigm Scribe is built around. Requires a blank-page trigger, not a selection trigger. Vastly increases scope and testing surface. The Scribe backend API is designed for text-in/text-out, not document generation. | Stay focused on selection-based transformations. If users want doc generation, they can select nothing and use the free-form prompt as a future enhancement. |
| **Real-time grammar underlining (Grammarly-style)** | Grammarly's red/blue underlines are iconic. Users may expect continuous passive analysis. | Requires the OnlyOffice plugin to continuously analyze the entire document, not just react to user-initiated selection. Massive performance and complexity cost. Conflicts with OnlyOffice's own spellcheck. Would require deep integration with the editor's rendering pipeline, not just the plugin API. | Offer grammar correction as an on-demand action (select text, click "Fix grammar"). Do not attempt passive continuous analysis. |
| **AI-powered formatting/styling** | "Make this a table", "add headers", "format as bullet list". Copilot and Notion handle structural changes. | Requires the plugin to manipulate OnlyOffice document structure (paragraphs, tables, lists), not just text content. The formatting preservation risk is already identified in PROJECT.md as a major technical uncertainty. Structural changes are an order of magnitude harder. | Limit v1 to text content changes only. Formatting preservation (bold, italic, etc.) is already a stretch goal. Structural changes are out of scope. |
| **Multi-provider model selection** | OnlyOffice's AI plugin lets users pick ChatGPT, Claude, Gemini, etc. Seems flexible. | Scribe has a defined backend API ("moteur IA Scribe"). Adding model selection introduces configuration complexity, inconsistent output quality, and API key management that contradicts the simple consumer-facing UX Cozy targets. | Use the Scribe backend as the single AI provider. The backend team can swap models server-side without exposing this to users. Simplicity is a feature. |
| **Autonomous AI agents** | Notion AI agents can work autonomously for 20 minutes. Microsoft has "Agent Mode" in Word. Trendy in 2025-2026. | Completely misaligned with Scribe's scope and the user-in-control philosophy. Agents modify documents without preview, which contradicts "previsualisation avant application" requirement. Enormous technical scope. | Keep the human in the loop. Every change must be previewed and explicitly accepted. This is a philosophical choice aligned with Cozy's values. |
| **Image generation / OCR** | OnlyOffice AI plugin supports text-to-image and OCR. Visual AI features are attention-grabbing. | Orthogonal to the text editing assistant use case. Different backend capabilities, different UI, different user journey. Scatters focus. | Defer entirely. These could be separate features of Cozy Drive, not part of Scribe. |
| **Summarize entire document** | Already partially exists in Cozy Drive (SummarizeByAIButton in the toolbar). Tempting to put it in Scribe too. | A document-level summarize button already exists in `src/modules/views/OnlyOffice/Toolbar/SummarizeByAIButtonWrapper.tsx` using `cozy-viewer`'s `AIAssistantPanel`. Duplicating this in Scribe creates confusion about which AI tool does what. | Keep document-level summarization in the existing toolbar button. Scribe handles selection-based operations. Clear separation of concerns. |

---

## Feature Dependencies

```
[OnlyOffice Plugin: Selection Detection]
    |
    +--requires--> [Contextual "Scribe" Button at Selection]
    |                   |
    |                   +--requires--> [Scribe Iframe Opening]
    |                                       |
    |                                       +--requires--> [postMessage Protocol]
    |                                       |                   |
    |                                       |                   +--enables--> [Send Text + Instruction to AI]
    |                                       |                   |                   |
    |                                       |                   |                   +--enables--> [Preview AI Result]
    |                                       |                   |                                     |
    |                                       |                   |                                     +--enables--> [Accept (Replace)]
    |                                       |                   |                                     +--enables--> [Accept (Insert)]
    |                                       |                   |                                     +--enables--> [Reject / Regenerate]
    |                                       |                   |                                     +--enables--> [Edit Before Applying]
    |                                       |                   |
    |                                       |                   +--enables--> [All AI Actions Below]
    |                                       |
    |                                       +--requires--> [Action Menu UI in Scribe Iframe]
    |                                                           |
    |                                                           +--enables--> [Rewrite / Rephrase]
    |                                                           +--enables--> [Tone Adjustment]
    |                                                           +--enables--> [Grammar Correction]
    |                                                           +--enables--> [Translation]
    |                                                           +--enables--> [Lengthen / Shorten]
    |                                                           +--enables--> [Free-form Prompt]

[Replace Selected Text in Document]
    |
    +--requires--> [OnlyOffice Plugin: Write to Document API]
    +--requires--> [Formatting Preservation] (risk: may not be fully achievable)

[Streaming Preview] --enhances--> [Preview AI Result]

[Visual Diff] --enhances--> [Preview AI Result]

[Conversation Memory] --enhances--> [Free-form Prompt]
    +--requires--> [Session State in Scribe Iframe]
```

### Dependency Notes

- **Selection Detection requires the OnlyOffice Plugin POC:** The entire feature chain depends on the plugin being able to read the user's text selection. This is the highest-risk dependency (noted in PROJECT.md).
- **Replace requires Write-to-Document API:** Reading selection is necessary but not sufficient. The plugin must also write back. These are two separate API capabilities that must both work.
- **Formatting Preservation is a risk multiplier:** Every feature that involves Replace is harder if formatting must be preserved. The POC must determine what level of formatting preservation is achievable.
- **All AI actions share the same pipeline:** Once the selection-to-preview pipeline works, adding new AI actions (rewrite, translate, fix grammar) is incremental -- they differ only in the instruction sent to the Scribe backend.
- **Streaming Preview and Visual Diff are independent enhancements:** They improve the preview step but are not required for the core flow to work.
- **Conversation Memory requires session state:** This is architecturally separate from the core flow and should be deferred.

---

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to validate that the end-to-end chain works and users find it valuable.

- [ ] **Plugin selection detection + contextual Scribe button** -- the entry point; without this, nothing works
- [ ] **postMessage communication protocol** -- the bridge between the OnlyOffice iframe and the Scribe iframe
- [ ] **Scribe iframe with action menu** -- the UI layer (improve, rephrase, fix grammar, translate, free-form prompt)
- [ ] **AI result preview** -- show the user what the AI produced before applying
- [ ] **Replace selected text** -- the primary action; the reason Scribe exists
- [ ] **Insert after selection** -- the secondary action; low marginal cost once Replace works
- [ ] **Accept / Reject cycle** -- user must be able to say no and try again
- [ ] **Rewrite action** -- the single most common AI writing action across all competitors
- [ ] **Grammar/spelling correction action** -- low-complexity, high-value, immediate utility
- [ ] **Free-form prompt** -- the escape hatch for anything the preset actions don't cover

### Add After Validation (v1.x)

Features to add once the core pipeline is proven stable.

- [ ] **Tone adjustment** -- add when users ask "can I make this more formal?" (likely immediately)
- [ ] **Lengthen / Shorten** -- add when users ask for length control (likely immediately)
- [ ] **Translation** -- add when the backend supports target language parameter (requires language picker UI)
- [ ] **Editable preview** -- add when users report wanting to tweak AI output before applying
- [ ] **Streaming preview** -- add when perceived latency becomes a complaint
- [ ] **Visual diff** -- add when users report difficulty understanding what changed

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Conversation memory / iterative refinement** -- defer because it requires session state management and backend conversation support
- [ ] **Privacy-first messaging / self-hosted model option** -- defer the technical work (self-hosted LLM) but start the messaging immediately
- [ ] **Additional actions (summarize selection, simplify, explain)** -- defer because the free-form prompt covers these; dedicated buttons are a convenience optimization

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Plugin selection detection | HIGH | HIGH | P1 |
| Contextual Scribe button | HIGH | HIGH | P1 |
| postMessage protocol | HIGH | MEDIUM | P1 |
| Scribe iframe + action menu | HIGH | MEDIUM | P1 |
| AI result preview | HIGH | MEDIUM | P1 |
| Replace selected text | HIGH | HIGH | P1 |
| Insert after selection | MEDIUM | LOW | P1 |
| Accept / Reject / Regenerate | HIGH | LOW | P1 |
| Rewrite action | HIGH | LOW | P1 |
| Grammar correction | HIGH | LOW | P1 |
| Free-form prompt | HIGH | MEDIUM | P1 |
| Tone adjustment | MEDIUM | LOW | P2 |
| Lengthen / Shorten | MEDIUM | LOW | P2 |
| Translation | MEDIUM | MEDIUM | P2 |
| Editable preview | MEDIUM | MEDIUM | P2 |
| Streaming preview | MEDIUM | MEDIUM | P2 |
| Visual diff | MEDIUM | MEDIUM | P2 |
| Conversation memory | LOW | HIGH | P3 |
| Self-hosted model support | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- the end-to-end chain must work
- P2: Should have, add in v1.x -- incremental improvements to the proven pipeline
- P3: Nice to have, future consideration -- architecturally separate or very complex

---

## Competitor Feature Analysis

| Feature | Notion AI | Google Docs Gemini | Microsoft Copilot Word | Grammarly | OnlyOffice AI Plugin | Scribe (Our Approach) |
|---------|-----------|-------------------|----------------------|-----------|---------------------|----------------------|
| **Trigger mechanism** | "Ask AI" button, /AI command | Floating pencil icon, top-of-page prompt | Copilot sidebar, margin icon | Always-on underlines + popup | Ctrl+/ shortcut, Plugin tab | Contextual button at selection end |
| **Rewrite/Rephrase** | Yes | Yes ("Rephrase") | Yes | Yes | Yes | Yes (P1) |
| **Tone adjustment** | Yes ("Change tone") | Yes (Formal/Casual) | Yes | Yes | Yes (custom prompts) | Yes (P2) |
| **Grammar/Spelling** | Yes ("Fix spelling & grammar") | Implicit in Rephrase | Implicit in rewrite | Core product (real-time) | Yes | Yes (P1, on-demand) |
| **Translation** | Yes (multi-language) | Yes (4+ languages) | Yes | Yes (6 languages) | Yes | Yes (P2) |
| **Lengthen/Shorten** | Yes | Yes ("Elaborate"/"Shorten") | Yes | Yes | Yes | Yes (P2) |
| **Free-form prompt** | Yes ("Ask AI anything") | Yes ("Custom" refinement) | Yes (natural language) | Yes (AI Chat) | Yes (agent chat) | Yes (P1) |
| **Preview before apply** | Yes (gray/blue diff) | Yes (panel with options) | Yes (Keep/Regenerate/Discard) | Yes (inline suggestions) | Yes (Hint mode) | Yes (P1, editable) |
| **Replace** | Yes | Yes | Yes ("Keep it") | Yes (accept suggestion) | Yes | Yes (P1) |
| **Insert** | Yes | Yes | No (replace only) | No | Yes | Yes (P1) |
| **Edit before applying** | No (accept or reject only) | No | No (but can "Fine-tune") | No | No | Yes (P2, differentiator) |
| **Streaming response** | No | No | No | No | No | Planned (P2) |
| **Visual diff** | Yes (gray/blue) | No | No | Yes (inline) | No | Planned (P2) |
| **Full doc generation** | Yes | Yes | Yes | No | Yes | No (anti-feature) |
| **Autonomous agents** | Yes (2026) | No | Yes ("Agent Mode") | Yes (specialized agents) | Yes (beta agent) | No (anti-feature) |
| **Model selection** | Yes (OpenAI, Anthropic, Google) | No (Gemini only) | No (Copilot only) | No (proprietary) | Yes (multi-provider) | No (anti-feature) |
| **Data sovereignty** | No (US cloud) | No (Google cloud) | No (Microsoft cloud) | No (US cloud) | Possible (self-hosted) | Yes (Cozy-controlled, differentiator) |

---

## Interaction Pattern Summary

The research reveals a clear convergence in how AI writing assistants work. The standard interaction loop:

1. **Trigger:** User selects text, then activates AI (click button, keyboard shortcut, or slash command)
2. **Choose action:** Preset menu (rewrite, translate, fix grammar) or free-form prompt
3. **Wait:** Spinner or streaming preview while AI processes
4. **Preview:** AI result shown alongside or replacing original text
5. **Decide:** Accept (replace/insert), Reject, or Regenerate
6. **Iterate:** Optionally refine with follow-up instructions

Scribe follows this exact pattern. The differentiating choices are:
- **Contextual trigger** (button at selection, not keyboard shortcut or toolbar menu)
- **Editable preview** (user can modify AI output before applying)
- **Privacy-first** (data stays within Cozy infrastructure)
- **No autonomous agents** (human always in the loop)

---

## Sources

- [Notion AI product page](https://www.notion.com/product/ai) -- feature overview, agent capabilities
- [Notion AI for Docs guide](https://www.notion.com/help/guides/notion-ai-for-docs) -- interaction patterns, improve writing flow
- [Google Docs Gemini features](https://workspace.google.com/products/docs/ai/) -- Help me write/refine capabilities
- [Google Docs Help me write flow](https://www.computerworld.com/article/1627842/how-to-use-help-me-write-ai-writing-tool-google-docs-gmail.html) -- detailed UX walkthrough
- [Microsoft Copilot in Word](https://support.microsoft.com/en-us/office/draft-and-add-content-with-copilot-in-word-069c91f0-9e42-4c9a-bbce-fddf5d581541) -- Keep/Regenerate/Discard/Fine-tune pattern
- [Microsoft Copilot Agent Mode](https://www.thurrott.com/a-i/329760/ignite-2025-microsoft-365-copilot-adds-new-word-excel-and-powerpoint-agents-and-more) -- agent capabilities
- [Grammarly features](https://www.grammarly.com/features) -- real-time correction, rewrite, tone
- [Grammarly AI agents launch](https://www.grammarly.com/blog/company/grammarly-launches-ai-agents/) -- specialized agents, Docs product
- [OnlyOffice AI plugin update](https://www.onlyoffice.com/blog/2025/04/ai-plugin-updated) -- 5 action buttons (Generate/Copy/Replace/Insert/Comment), multi-model support
- [OnlyOffice AI agent beta](https://www.onlyoffice.com/blog/2025/08/meet-the-new-ai-agent-for-onlyoffice) -- Ctrl+/ trigger, floating panel, conversation context
- [OnlyOffice custom AI assistants](https://www.onlyoffice.com/blog/2026/01/updated-ai-plugin-create-your-own-assistants) -- custom prompts, Hint/Replace/Hint+Replace display modes
- [OnlyOffice AI assistants page](https://www.onlyoffice.com/ai-assistants) -- full feature list
- [AI UI patterns - streaming](https://www.patterns.dev/react/ai-ui-patterns/) -- streaming output patterns, perceived speed
- [AI UX design patterns](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/) -- inline prompts, contextual awareness
- [Nextcloud open-source AI](https://nextcloud.com/blog/how-open-source-ai-models-can-help-you-take-control-of-your-privacy/) -- privacy-first AI assistant comparison

---
*Feature research for: AI writing assistant integrated into OnlyOffice within Cozy Drive*
*Researched: 2026-02-26*
