# Scribe pour OnlyOffice

## What This Is

Un assistant d'écriture IA intégré à OnlyOffice au sein de Cozy Drive. L'utilisateur sélectionne du texte dans l'éditeur, un bouton flottant Scribe apparaît, il choisit une action IA (réécriture, traduction, correction, prompt libre…), prévisualise le résultat dans un panneau adaptatif, puis remplace ou insère dans le document.

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

### Active

- [ ] Intégration API LLM réelle (remplacer mockTransform)
- [ ] Refactoring Scribe en composant autonome intégrable dans d'autres apps Cozy
- [ ] Gestion du formatage : markdown ↔ document (sérialisation/désérialisation)

### Out of Scope

- Développement du moteur IA Scribe (backend) — service existant, on consomme son API
- Migration de l'interface Scribe vers une application Cozy séparée — projet ultérieur (v3.0)
- Support mobile natif — web-first, Cozy Drive est une application web
- Édition collaborative simultanée avec Scribe — complexité excessive
- Correction grammaticale passive en temps réel (style Grammarly) — performance prohibitive

## Context

### Shipped v1.0

~1,610 LOC (1,207 React/Stylus + 403 OO plugin ES5).
Tech stack : React 18 + MUI + cozy-ui, postMessage protocol, OO Plugin API, Docker dev env.
4 jours de développement (2026-02-28 → 2026-03-03), 10 plans exécutés.

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

- API backend LLM pas encore intégrée (mock uniquement)
- Formatage riche (bold, italic) perdu lors de l'extraction/réinjection
- OO dark theme pas systématiquement testé

## Constraints

- **Écosystème** : Doit s'intégrer dans l'écosystème Cozy Cloud existant (cozy-client, cozy-ui)
- **Plugin ES5** : Le code plugin OO doit utiliser la syntaxe ES5 (pas d'arrow functions, pas de const/let)
- **OnlyOffice** : Compatibilité vérifiée avec OO 9.3.0-138
- **API Backend** : Le contrat d'API du moteur IA Scribe n'est pas encore figé

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

---
*Last updated: 2026-03-03 after v1.0 milestone*
