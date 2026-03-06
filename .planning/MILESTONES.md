# Milestones

## v2.0 Scribe Live AI (Shipped: 2026-03-06)

**Phases completed:** 3 phases, 5 plans, 9 tasks
**Timeline:** 3 days (2026-03-04 → 2026-03-06)
**Commits:** 24 | **Files modified:** 39 (+3,392 / -131 lines)

**Key accomplishments:**
- Intégration LLM réelle — module scribeAI avec appels API via cozy-stack POST /ai/v1/chat/completions
- Loading UX — machine d'état 3 étapes (menu/loading/result) avec spinner et annulation AbortController
- Gestion d'erreurs — classifyScribeError avec retry pour erreurs transitoires, messages clairs pour erreurs permanentes
- Couche i18n — 40 clés de traduction dans 5 locales (fr, en, de, es, it) avec pattern labelKey
- Composants JSX i18n — les 6 composants Scribe utilisent t() — zéro chaîne hardcodée

---

## v1.0 Scribe Interface Mock AI (Shipped: 2026-03-03)

**Phases completed:** 6 phases, 10 plans
**Timeline:** 4 days (2026-02-28 → 2026-03-03)
**LOC:** ~1,610 (1,207 React/Stylus + 403 OO plugin)

**Key accomplishments:**
- Plugin OO fonctionnel — chargé dans Docker, détection de sélection, lecture/remplacement/insertion de texte
- Protocole postMessage cross-iframe — communication bidirectionnelle plugin ↔ Cozy Drive via cozy-bridge
- Interface Scribe complète — menu d'actions, sous-menus, prompt libre, panneau de résultat, Replace/Insert/Cancel
- Bouton flottant contextuel — positionné au-dessus de l'éditeur via React portal, lié à la sélection
- Config déclarative unique — SCRIBE_ACTIONS source de vérité pour menu, prompts AI, et transformations mock
- Panneau de résultat adaptatif — dimensionnement dynamique avec transitions CSS

**Known Gaps:**
- Phase 4 requirements (UI-05/06/07) covered by Phases 2-3 but not formally planned/executed as phase 4
- REQUIREMENTS.md traceability was not kept up to date during execution

---

