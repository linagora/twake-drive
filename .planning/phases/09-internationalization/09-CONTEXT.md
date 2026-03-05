# Phase 9: Internationalization - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

All Scribe UI text is translated via cozy-ui i18n for every supported locale. No hardcoded French or English strings remain in any Scribe component. Switching the Cozy locale changes all Scribe UI text (action labels, buttons, tooltips, error messages).

</domain>

<decisions>
## Implementation Decisions

### Locale coverage
- Ship 5 locales at launch: fr, en, de, es, it (French + English + major European)
- French is the source language — write fr strings first, translate to en/de/es/it
- LLM-generated translations for de/es/it (Claude/GPT for ~40 UI strings)
- Unsupported locales (ar, ja, ko, zh_CN, etc.) fall back to English

### Action menu labels
- Fully translate all action labels: "Corriger la grammaire", "Raccourcir", etc. in French
- All menu items, submenu items, and prompt placeholders get translated
- Translate the free-prompt placeholder ("Help me write" -> "Aidez-moi a ecrire" etc.)

### Language names in translate submenu
- Keep native language names as-is: "Francais", "English", "Deutsch" — no translation needed
- LANG_NAMES stays unchanged (each language name in its own script)

### Brand naming
- "Scribe" stays untranslated across all locales (product name)
- "Text AI" tooltip gets translated ("IA Texte" in French, etc.)
- Keyboard shortcut "(Ctrl+I)" stays untranslated

### Claude's Discretion
- Key naming convention in locale JSON files (e.g., "Scribe.menu_translate" namespace)
- Loading and error message translation structure (dynamic interpolation patterns)
- Exact wording of translated strings (within the semantic intent)
- Whether to add Scribe keys to existing locale files or create separate ones

</decisions>

<specifics>
## Specific Ideas

- LLM prompts sent to the AI endpoint stay in English (Phase 7 decision) — only UI-facing strings get translated
- System prompt "respond in same language as input" handles LLM output language (Phase 7 decision)
- "Inserer" button in ScribeResultPanel is already French — normalize to i18n key

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useI18n` from `twake-i18n`: returns `{ t, f, lang }` — standard translation hook used everywhere
- `src/locales/{locale}.json`: 16 existing locale files with flat/nested JSON structure
- `%{variable}` interpolation pattern for dynamic strings (e.g., "Translating to %{language}...")
- `%{smart_count}` for pluralization (not needed for Scribe but available)

### Established Patterns
- Dot-nested categories in locale JSON: `"Nav.item_drive"`, `"toolbar.menu_upload"`
- Components call `const { t } = useI18n()` then `t('Category.key_name')`
- All 16 locales have the same key structure (incomplete locales fall back)

### Integration Points
- 8 Scribe files with ~40+ hardcoded strings to replace:
  - `ScribeFloatingButton.jsx`: "Text AI", "(Ctrl+I)", "Scribe"
  - `ScribeActionMenu.jsx`: "Other language..."
  - `ScribePromptInput.jsx`: "Help me write"
  - `ScribeResultPanel.jsx`: "Retry", "Replace", "Inserer"
  - `scribeActions.js`: 13 action labels + LANG_NAMES
  - `scribeAI.js`: 8 loading messages + 7 error messages
  - `ScribeModal.jsx`: "Scribe", "Selected text:", "Cancel", "Insert After", "Replace"
- `scribeActions.js` prompt fields stay English (LLM instructions, not UI)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-internationalization*
*Context gathered: 2026-03-06*
