# Phase 9: Internationalization - Research

**Researched:** 2026-03-06
**Domain:** i18n / locale translation for React components using twake-i18n
**Confidence:** HIGH

## Summary

Phase 9 is a straightforward internationalization task: replace ~40 hardcoded strings across 8 Scribe source files with `t()` calls from `twake-i18n`, and add corresponding keys to the existing locale JSON files. The project already has a mature i18n infrastructure -- 14 locale files, a well-established `useI18n` hook pattern, nested JSON key structure, and `%{variable}` interpolation. No new libraries or architecture changes are needed.

The primary complexity lies in the `deriveLoadingMessage()` function in `scribeAI.js`, which currently uses a label-to-gerund lookup map that must be refactored to use i18n keys instead of English string matching. Error messages from `classifyScribeError()` also need i18n keys. Action labels in `scribeActions.js` should remain as key identifiers (not display text), with the display text resolved via `t()` at render time.

**Primary recommendation:** Add a `Scribe` top-level key to all locale JSON files with nested subcategories (menu, tone, improve, translate, result, loading, error). Refactor `deriveLoadingMessage()` to accept a `t` function and use action IDs for lookup instead of English label matching.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Ship 5 locales at launch: fr, en, de, es, it (French + English + major European)
- French is the source language -- write fr strings first, translate to en/de/es/it
- LLM-generated translations for de/es/it (Claude/GPT for ~40 UI strings)
- Unsupported locales (ar, ja, ko, zh_CN, etc.) fall back to English
- Fully translate all action labels: "Corriger la grammaire", "Raccourcir", etc. in French
- All menu items, submenu items, and prompt placeholders get translated
- Translate the free-prompt placeholder ("Help me write" -> "Aidez-moi a ecrire" etc.)
- Keep native language names as-is: "Francais", "English", "Deutsch" -- no translation needed
- LANG_NAMES stays unchanged (each language name in its own script)
- "Scribe" stays untranslated across all locales (product name)
- "Text AI" tooltip gets translated ("IA Texte" in French, etc.)
- Keyboard shortcut "(Ctrl+I)" stays untranslated
- LLM prompts sent to the AI endpoint stay in English -- only UI-facing strings get translated
- System prompt "respond in same language as input" handles LLM output language

### Claude's Discretion
- Key naming convention in locale JSON files (e.g., "Scribe.menu_translate" namespace)
- Loading and error message translation structure (dynamic interpolation patterns)
- Exact wording of translated strings (within the semantic intent)
- Whether to add Scribe keys to existing locale files or create separate ones

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| I18N-01 | All Scribe UI strings use cozy-ui i18n system (no hardcoded French or English strings) | String audit below identifies all ~40 strings; architecture pattern shows how to replace each with `t()` calls |
| I18N-02 | Translations provided for all cozy-ui supported locales | 5 locales (fr/en/de/es/it) get full translations; remaining 9 locales fall back to English via existing fallback mechanism |
| I18N-03 | Action labels, button text, error messages, and tooltips are all translated | Comprehensive string catalog below covers every category; code examples show the pattern for each |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| twake-i18n | (existing) | `useI18n` hook providing `t()`, `f()`, `lang` | Already used across the entire codebase; provides locale fallback |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All infrastructure already exists |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Adding to existing locale files | Separate Scribe locale files | Separate files would need custom loading; existing pattern adds keys to `src/locales/*.json` -- follow the established pattern |

**Installation:**
```bash
# No new packages needed -- twake-i18n is already installed
```

## Architecture Patterns

### Recommended Key Structure

Add a `Scribe` top-level key to each locale JSON file, following the existing `OnlyOffice` pattern:

```json
{
  "Scribe": {
    "menu": {
      "correct_grammar": "Correct grammar",
      "translate": "Translate",
      "change_tone": "Change tone",
      "improve": "Improve"
    },
    "tone": {
      "professional": "More professional",
      "casual": "More casual",
      "polite": "More polite"
    },
    "improve": {
      "shorter": "Make it shorter",
      "expand": "Expand context",
      "emojify": "Emojify",
      "bullets": "Transform to bullets"
    },
    "translate": {
      "other_language": "Other language...",
      "translating_to": "Translating to %{language}..."
    },
    "prompt": {
      "placeholder": "Help me write"
    },
    "button": {
      "text_ai": "Text AI",
      "insert": "Insert",
      "replace": "Replace",
      "retry": "Retry",
      "cancel": "Cancel",
      "insert_after": "Insert After"
    },
    "modal": {
      "selected_text": "Selected text:"
    },
    "loading": {
      "processing": "Processing...",
      "correct_grammar": "Correcting grammar...",
      "tone_professional": "Making it more professional...",
      "tone_casual": "Making it more casual...",
      "tone_polite": "Making it more polite...",
      "improve_shorter": "Making it shorter...",
      "improve_expand": "Expanding context...",
      "improve_emojify": "Emojifying...",
      "improve_bullets": "Transforming to bullets..."
    },
    "error": {
      "auth": "Authorization error. Please check your Cozy permissions.",
      "rate_limit": "Too many requests. Please wait a moment and try again.",
      "server": "The AI service is temporarily unavailable. Please try again.",
      "generic": "Something went wrong. Please try again later.",
      "network": "Network error. Check your connection and try again.",
      "empty_response": "No result received. Please try again.",
      "unexpected": "An unexpected error occurred. Please try again."
    }
  }
}
```

### Pattern 1: Replace Label Strings with t() Lookups

**What:** Action labels in `scribeActions.js` become i18n keys; components resolve display text via `t()`.
**When to use:** Every Scribe component that displays user-facing text.

**Current (hardcoded):**
```javascript
// scribeActions.js
{ id: 'correct-grammar', label: 'Correct grammar', ... }
```

**After (i18n key):**
```javascript
// scribeActions.js
{ id: 'correct-grammar', labelKey: 'Scribe.menu.correct_grammar', ... }
```

```jsx
// ScribeActionMenu.jsx
const { t } = useI18n()
// ...
<ListItemText primary={t(action.labelKey)} />
```

### Pattern 2: Refactor deriveLoadingMessage to Use Action IDs

**What:** Replace the English-label-to-gerund lookup map with an action-ID-to-i18n-key map.
**Why:** The current approach matches on English strings (`'Correct grammar'` -> `'Correcting grammar...'`), which breaks when labels are translated.

**Current (broken under i18n):**
```javascript
const loadingMessages = {
  'Correct grammar': 'Correcting grammar...',
  // ...
}
if (loadingMessages[label]) return loadingMessages[label]
```

**After (ID-based):**
```javascript
const LOADING_KEYS = {
  'correct-grammar': 'Scribe.loading.correct_grammar',
  'tone-professional': 'Scribe.loading.tone_professional',
  // ...
}

export function deriveLoadingMessage(actionId, label, t) {
  if (actionId === 'free-prompt') return t('Scribe.loading.processing')
  if (actionId.startsWith('translate-')) return t('Scribe.translate.translating_to', { language: label })
  if (LOADING_KEYS[actionId]) return t(LOADING_KEYS[actionId])
  return `${t ? label : label}...`
}
```

### Pattern 3: Error Messages via t()

**What:** `classifyScribeError()` returns i18n keys instead of English strings; the caller resolves them with `t()`.

**After:**
```javascript
export function classifyScribeError(err) {
  // ...
  if (err.status === 401 || err.status === 403) {
    return { messageKey: 'Scribe.error.auth', canRetry: false }
  }
  // ...
}

// In ScribePopover.jsx:
const classified = classifyScribeError(err)
const errorMessage = t(classified.messageKey)
```

### Anti-Patterns to Avoid
- **Matching on translated labels:** Never use `label === 'Correct grammar'` for logic -- use action IDs
- **Passing `t` deep into utility functions:** Prefer returning keys and resolving at the component level
- **Forgetting `%{variable}` syntax:** twake-i18n uses `%{var}` not `${var}` or `{var}` for interpolation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translation system | Custom translation loader | twake-i18n `useI18n().t()` | Already integrated, handles fallback |
| Locale fallback | Custom fallback logic | twake-i18n built-in fallback | Unsupported locales auto-fall back |
| Interpolation | Template literals | `%{variable}` pattern | Consistent with all 700+ existing keys |

## Common Pitfalls

### Pitfall 1: deriveLoadingMessage Breaks Under Translation
**What goes wrong:** `deriveLoadingMessage()` uses a lookup map keyed by English label strings. Once labels are translated, the lookup fails silently and falls through to the generic `${label}...` fallback.
**Why it happens:** The function was designed pre-i18n, matching on display text.
**How to avoid:** Refactor to use action IDs as lookup keys instead of labels.
**Warning signs:** Loading messages show raw translated labels with "..." appended instead of proper gerund forms.

### Pitfall 2: Action Labels Used in Breadcrumbs
**What goes wrong:** `ScribePopover` passes `breadcrumb` strings like `"Change tone > More professional"` which are constructed from raw labels. Under i18n, these must also be translated.
**Why it happens:** Breadcrumbs are concatenated from `action.label` + " > " + `child.label` at selection time.
**How to avoid:** Construct breadcrumbs from translated labels: `t(action.labelKey) + ' > ' + t(child.labelKey)`.
**Warning signs:** Breadcrumbs show i18n keys instead of translated text.

### Pitfall 3: "Inserer" Already in French
**What goes wrong:** The Insert button in `ScribeResultPanel.jsx` is already hardcoded as "Inserer" (French) instead of an English string.
**Why it happens:** Developer wrote it in French by default.
**How to avoid:** Replace with `t('Scribe.button.insert')` and add proper translations for all locales.
**Warning signs:** Button says "Inserer" when locale is English.

### Pitfall 4: Prompt Strings Must Stay English
**What goes wrong:** Someone translates the `prompt` field in `scribeActions.js`, causing the LLM to receive non-English instructions.
**Why it happens:** Confusion between UI labels (translate) and LLM prompts (keep English).
**How to avoid:** Only replace `label` fields. Leave `prompt` fields unchanged. Add a code comment: `// LLM prompt -- do NOT translate`.
**Warning signs:** AI returns unexpected results because prompt language changed.

### Pitfall 5: Missing Keys in Non-Primary Locales
**What goes wrong:** de/es/it locale files have fewer keys than en/fr (de: 502 lines vs en: 735 lines). Adding Scribe keys to en/fr but forgetting de/es/it means those locales fall back to English for Scribe strings.
**Why it happens:** Manual copy-paste across 5 files.
**How to avoid:** Add keys to all 5 locale files in a single task. Use a checklist.

## Code Examples

### Adding useI18n to ScribeFloatingButton

```jsx
// ScribeFloatingButton.jsx
import { useI18n } from 'twake-i18n'

export const ScribeFloatingButton = ({ visible, onClick }) => {
  const { t } = useI18n()
  // ...
  <span style={{ color: 'white' }}>{t('Scribe.button.text_ai')}</span>
  <span style={{ color: '#999' }}>(Ctrl+I)</span>
  // "Scribe" stays as literal text (brand name, not translated)
}
```

### Adding useI18n to ScribePromptInput

```jsx
// ScribePromptInput.jsx
import { useI18n } from 'twake-i18n'

const ScribePromptInput = forwardRef(({ onSubmit, onArrow, onEscape }, ref) => {
  const { t } = useI18n()
  // ...
  <InputBase placeholder={t('Scribe.prompt.placeholder')} ... />
})
```

### Translating ScribeResultPanel Buttons

```jsx
// ScribeResultPanel.jsx
import { useI18n } from 'twake-i18n'

const ScribeResultPanel = ({ ... }) => {
  const { t } = useI18n()
  // ...
  <Buttons label={t('Scribe.button.retry')} ... />
  <Buttons label={t('Scribe.button.replace')} ... />
  <Buttons label={t('Scribe.button.insert')} ... />
}
```

### French Locale Example (Source Language)

```json
{
  "Scribe": {
    "menu": {
      "correct_grammar": "Corriger la grammaire",
      "translate": "Traduire",
      "change_tone": "Changer le ton",
      "improve": "Ameliorer"
    },
    "tone": {
      "professional": "Plus professionnel",
      "casual": "Plus decontracte",
      "polite": "Plus poli"
    },
    "improve": {
      "shorter": "Raccourcir",
      "expand": "Developper",
      "emojify": "Emojifier",
      "bullets": "Transformer en liste"
    },
    "translate": {
      "other_language": "Autre langue...",
      "translating_to": "Traduction en %{language}..."
    },
    "prompt": {
      "placeholder": "Aidez-moi a ecrire"
    },
    "button": {
      "text_ai": "IA Texte",
      "insert": "Inserer",
      "replace": "Remplacer",
      "retry": "Reessayer",
      "cancel": "Annuler",
      "insert_after": "Inserer apres"
    },
    "loading": {
      "processing": "Traitement en cours...",
      "correct_grammar": "Correction de la grammaire...",
      "tone_professional": "Ton plus professionnel...",
      "tone_casual": "Ton plus decontracte...",
      "tone_polite": "Ton plus poli...",
      "improve_shorter": "Raccourcissement...",
      "improve_expand": "Developpement...",
      "improve_emojify": "Ajout d'emojis...",
      "improve_bullets": "Transformation en liste..."
    },
    "error": {
      "auth": "Erreur d'autorisation. Verifiez vos permissions Cozy.",
      "rate_limit": "Trop de requetes. Veuillez patienter et reessayer.",
      "server": "Le service IA est temporairement indisponible. Veuillez reessayer.",
      "generic": "Une erreur est survenue. Veuillez reessayer plus tard.",
      "network": "Erreur reseau. Verifiez votre connexion et reessayez.",
      "empty_response": "Aucun resultat recu. Veuillez reessayer.",
      "unexpected": "Une erreur inattendue est survenue. Veuillez reessayer."
    }
  }
}
```

## Complete String Audit

All hardcoded UI strings that need i18n keys:

| File | String | Proposed Key | Notes |
|------|--------|-------------|-------|
| ScribeFloatingButton.jsx | "Text AI" | `Scribe.button.text_ai` | Tooltip text |
| ScribeFloatingButton.jsx | "(Ctrl+I)" | -- | Keep literal (shortcut) |
| ScribeFloatingButton.jsx | "Scribe" | -- | Keep literal (brand) |
| ScribeActionMenu.jsx | "Other language..." | `Scribe.translate.other_language` | Input placeholder |
| ScribePromptInput.jsx | "Help me write" | `Scribe.prompt.placeholder` | Input placeholder |
| ScribeResultPanel.jsx | "Retry" | `Scribe.button.retry` | Button label |
| ScribeResultPanel.jsx | "Replace" | `Scribe.button.replace` | Button label |
| ScribeResultPanel.jsx | "Inserer" | `Scribe.button.insert` | Already French! |
| ScribeModal.jsx | "Scribe" | -- | Keep literal (brand) |
| ScribeModal.jsx | "Selected text:" | `Scribe.modal.selected_text` | Caption |
| ScribeModal.jsx | "Cancel" | `Scribe.button.cancel` | Button label |
| ScribeModal.jsx | "Insert After" | `Scribe.button.insert_after` | Button label |
| ScribeModal.jsx | "Replace" | `Scribe.button.replace` | Button label (reuse key) |
| scribeActions.js | "Correct grammar" | `Scribe.menu.correct_grammar` | Action label |
| scribeActions.js | "Translate" | `Scribe.menu.translate` | Action label |
| scribeActions.js | "Change tone" | `Scribe.menu.change_tone` | Action label |
| scribeActions.js | "More professional" | `Scribe.tone.professional` | Sub-action label |
| scribeActions.js | "More casual" | `Scribe.tone.casual` | Sub-action label |
| scribeActions.js | "More polite" | `Scribe.tone.polite` | Sub-action label |
| scribeActions.js | "Improve" | `Scribe.menu.improve` | Action label |
| scribeActions.js | "Make it shorter" | `Scribe.improve.shorter` | Sub-action label |
| scribeActions.js | "Expand context" | `Scribe.improve.expand` | Sub-action label |
| scribeActions.js | "Emojify" | `Scribe.improve.emojify` | Sub-action label |
| scribeActions.js | "Transform to bullets" | `Scribe.improve.bullets` | Sub-action label |
| scribeAI.js | "Processing..." | `Scribe.loading.processing` | Loading message |
| scribeAI.js | "Translating to ..." | `Scribe.translate.translating_to` | Loading (interpolated) |
| scribeAI.js | "Correcting grammar..." | `Scribe.loading.correct_grammar` | Loading message |
| scribeAI.js | "Making it more professional..." | `Scribe.loading.tone_professional` | Loading message |
| scribeAI.js | "Making it more casual..." | `Scribe.loading.tone_casual` | Loading message |
| scribeAI.js | "Making it more polite..." | `Scribe.loading.tone_polite` | Loading message |
| scribeAI.js | "Making it shorter..." | `Scribe.loading.improve_shorter` | Loading message |
| scribeAI.js | "Expanding context..." | `Scribe.loading.improve_expand` | Loading message |
| scribeAI.js | "Emojifying..." | `Scribe.loading.improve_emojify` | Loading message |
| scribeAI.js | "Transforming to bullets..." | `Scribe.loading.improve_bullets` | Loading message |
| scribeAI.js | "Authorization error..." | `Scribe.error.auth` | Error message |
| scribeAI.js | "Too many requests..." | `Scribe.error.rate_limit` | Error message |
| scribeAI.js | "The AI service is temporarily..." | `Scribe.error.server` | Error message |
| scribeAI.js | "Something went wrong..." | `Scribe.error.generic` | Error message |
| scribeAI.js | "Network error..." | `Scribe.error.network` | Error message |
| scribeAI.js | "No result received..." | `Scribe.error.empty_response` | Error message |
| scribeAI.js | "An unexpected error..." | `Scribe.error.unexpected` | Error message |

**Total: ~40 strings to translate, ~5 strings to keep literal**

## Locale File Coverage

| Locale | File | Action | Scribe Keys |
|--------|------|--------|-------------|
| fr | src/locales/fr.json | Add Scribe section (source language) | Full translations |
| en | src/locales/en.json | Add Scribe section | Full translations |
| de | src/locales/de.json | Add Scribe section | LLM-generated translations |
| es | src/locales/es.json | Add Scribe section | LLM-generated translations |
| it | src/locales/it.json | Add Scribe section | LLM-generated translations |
| ar, ja, ko, nl, nl_NL, pl, ru, vi, zh_CN, zh_TW | respective files | No Scribe keys needed | Falls back to English |

**Note:** The remaining 9 locale files do NOT need Scribe keys added. The twake-i18n fallback mechanism will serve English strings when a key is missing in a locale file. Since English keys exist, unsupported locales will display English text automatically.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded English strings | i18n keys via `t()` | This phase | All Scribe UI becomes locale-aware |
| Label-based loading message lookup | Action-ID-based loading message lookup | This phase | Loading messages work under translation |
| Return error strings from classifyScribeError | Return i18n keys from classifyScribeError | This phase | Error messages become translatable |

## Open Questions

1. **Should `deriveLoadingMessage` accept `t` as a parameter or should it return keys?**
   - What we know: Returning keys is cleaner (separates concerns), but requires changing the caller in ScribePopover
   - Recommendation: Return keys; resolve with `t()` in ScribePopover. This is consistent with how `classifyScribeError` should also return keys.

2. **Should action labels be stored as keys in scribeActions.js or resolved at render time?**
   - What we know: Currently `label: 'Correct grammar'` is a display string. It could become `labelKey: 'Scribe.menu.correct_grammar'`.
   - Recommendation: Rename `label` to `labelKey` and store the i18n key. Resolve with `t()` at render time in ScribeActionMenu. This avoids passing `t` into `buildTranslateChildren()`.

## Sources

### Primary (HIGH confidence)
- `src/locales/index.js` -- locale loading mechanism, 14 locales imported
- `src/locales/en.json` -- 735 lines, nested JSON structure, `%{variable}` interpolation
- `src/locales/fr.json` -- French source locale, same structure
- OnlyOffice key section in en.json (line 532) -- established naming pattern for OO features
- All 8 Scribe source files -- direct string audit

### Secondary (MEDIUM confidence)
- twake-i18n `useI18n` hook API -- observed usage pattern across 15+ files in codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries; twake-i18n already in use
- Architecture: HIGH -- straightforward key addition to existing JSON files
- Pitfalls: HIGH -- identified from direct code audit (deriveLoadingMessage label matching, "Inserer" bug)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, no external dependencies changing)
