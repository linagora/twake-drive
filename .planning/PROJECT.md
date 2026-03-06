# Scribe pour OnlyOffice

## What This Is

Un assistant d'écriture IA intégré à OnlyOffice au sein de Cozy Drive. L'utilisateur sélectionne du texte dans l'éditeur, un bouton flottant Scribe apparaît, il choisit une action IA (réécriture, traduction, correction, prompt libre…), prévisualise le résultat dans un panneau adaptatif, puis remplace ou insère dans le document. Les appels IA passent par cozy-stack (format OpenAI), avec gestion d'erreurs et retry. L'interface est internationalisée (fr, en, de, es, it).

## Core Value

La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — doit fonctionner de bout en bout, de manière transparente pour l'utilisateur.

## Requirements

### Validated

- ✓ Plugin OO se charge, détecte sélection, lit/remplace/insère du texte — v1.0
- ✓ Communication bidirectionnelle plugin ↔ Cozy Drive via postMessage/cozy-bridge — v1.0
- ✓ Interface Scribe : menu d'actions, sous-menus, prompt libre, panneau de résultat — v1.0
- ✓ Actions Replace/Insert/Cancel fonctionnelles — v1.0
- ✓ Bouton flottant contextuel positionné au-dessus de l'éditeur — v1.0
- ✓ Config déclarative SCRIBE_ACTIONS avec prompts AI par action — v1.0
- ✓ Panneau de résultat adaptatif (fit-content, viewport-relative) — v1.0
- ✓ Transformations mock fonctionnelles (préparation API réelle) — v1.0
- ✓ Intégration API LLM via cozy-stack POST /ai/v1/chat/completions (format OpenAI) — v2.0
- ✓ Loading UX avec indicateur visuel et annulation via AbortController — v2.0
- ✓ Gestion d'erreurs API avec retry (429, 500, réseau) et messages clairs (401, 403) — v2.0
- ✓ Internationalisation complète (fr, en, de, es, it) via twake-i18n — v2.0

### Active

- [ ] Streaming UX — affichage progressif token par token dans le panneau de résultat
- [ ] Annulation en cours de stream
- [ ] Fix dark theme (texte blanc sur blanc)
- [ ] Désactivation du bouton flottant quand pas de sélection
- [ ] Intégration menu contextuel

## Shipped: v2.0 Scribe Live AI (2026-03-06)

Intégration LLM réelle via cozy-stack, gestion d'erreurs avec retry, internationalisation 5 locales.
3 phases, 5 plans, 24 commits. Voir `.planning/MILESTONES.md` pour le détail.

**Repo unique:** `~/Dev-local/cozy-drive` — frontend uniquement, pas de modification cozy-stack

### Out of Scope

- Développement du moteur IA Scribe (backend) — service existant, on consomme son API
- Migration de l'interface Scribe vers une application Cozy séparée — projet ultérieur (v3.0)
- Support mobile natif — web-first, Cozy Drive est une application web
- Édition collaborative simultanée avec Scribe — complexité excessive
- Correction grammaticale passive en temps réel (style Grammarly) — performance prohibitive

## Context

### Shipped v2.0

~1,636 LOC Scribe module (React/Stylus + OO plugin ES5). 39 fichiers modifiés, +3,392 lignes.
Tech stack : React 18 + MUI + cozy-ui + twake-i18n, cozy-stack AI proxy, postMessage protocol, OO Plugin API.
v1.0 : 4 jours (2026-02-28 → 2026-03-03), 10 plans. v2.0 : 3 jours (2026-03-04 → 2026-03-06), 5 plans.

### Architecture à 3 couches (frame hierarchy)

1. **Cozy Stack** → **Cozy Drive iframe** → **OO Editor iframe** → **Plugin iframe**
2. Plugin communique via `postToAncestors()` (postMessage à tous les frames ancêtres)
3. CozyBridge dans Cozy Drive reçoit les intents, `useCozyBridge` hook gère l'état
4. Bouton flottant rendu via React portal sur document.body (z-index élevé pour passer au-dessus de l'iframe OO)

### Risques résolus

- ✓ API plugin OO viable (sélection, lecture, écriture confirmés)
- ✓ OO version 9.3.0-138 — bien au-dessus du minimum 8.2.1
- ✓ Communication cross-iframe fiable via postMessage avec intent protocol
- ✓ InsertContent remplace la sélection — workaround en place

### Risques ouverts

- Formatage riche (bold, italic) perdu lors de l'extraction/réinjection
- OO dark theme pas systématiquement testé

## Constraints

- **Écosystème** : Doit s'intégrer dans l'écosystème Cozy Cloud existant (cozy-client, cozy-ui)
- **Plugin ES5** : Le code plugin OO doit utiliser la syntaxe ES5 (pas d'arrow functions, pas de const/let)
- **OnlyOffice** : Compatibilité vérifiée avec OO 9.3.0-138
- **API Backend** : Utilisation de la route existante POST /ai/v1/chat/completions (format OpenAI, proxy cozy-stack → serveur RAG) — pas de modification stack

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| POC plugin OnlyOffice en priorité | Composant le plus risqué — lever les incertitudes | ✓ Good — API plugin confirmée viable |
| Communication via postMessage | Seul mécanisme standard cross-iframe | ✓ Good — protocole cozy-bridge fiable |
| Prévisualisation avant application | Contrôle utilisateur sur les modifications | ✓ Good — UX validée |
| Interface dans le repo Cozy Drive | Simplifier le dev initial | ✓ Good — migration prévue en v3.0 |
| Bouton flottant via React portal | Éviter les conflits z-index avec iframe OO | ✓ Good — positionnement fiable |
| SCRIBE_ACTIONS config déclarative | Source de vérité unique menu + prompts + transform | ✓ Good — extensibilité confirmée |
| mockResult DSL string-based | Sérialisable, prêt pour stockage JSON futur | ✓ Good — transition API facile |
| Plugin type "panel" pour le POC | Panneaux latéraux, non-bloquant | ⚠️ Revisit — bouton flottant a remplacé le panneau |
| fetchJSON direct au lieu de chatCompletion() | Support AbortController signal | ✓ Good — annulation fiable |
| Non-streaming pour v2.0 | Streaming déféré, simplifier l'intégration initiale | ✓ Good — fonctionnel, streaming en v2.x |
| Duck-typed FetchError (err.name) | Détection cross-module sans import | ✓ Good — classification d'erreurs robuste |
| labelKey pattern pour i18n | Actions déclaratives, résolution t() au render | ✓ Good — zéro chaîne hardcodée |
| 5 locales européennes (fr, en, de, es, it) | Couverture utilisateurs Cozy principaux | ✓ Good — extensible |

---
*Last updated: 2026-03-06 after v2.0 milestone*
