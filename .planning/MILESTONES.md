# Milestones

## v2.4 Document Builder Injection (Shipped: 2026-03-20)

**Phases completed:** 3 phases, 6 plans
**Timeline:** 4 days (2026-03-17 → 2026-03-20)

**Key accomplishments:**
- Pipeline Markdown → Document Builder API : marked tokenizer dans le plugin, flattenTokens, buildAndInject
- Inline formatting via Builder : bold, italic, strikethrough, code spans (Courier New), hyperlinks (CreateHyperlink)
- Block elements : headings H1-H6 (SetStyle), bullet/numbered lists (CreateNumbering avec niveaux)
- Smart spacing : space runs via Builder API aux bornes de l'injection (replace et insert)
- Insert mode : paragraphe séparateur + consommation d'espace trailing
- Post-injection selection : deux stratégies (selectByRefs pour block, selectByPositions pour inline)
- Font style preservation : lecture font/size du paragraphe source, application aux runs injectés
- PasteHtml fallback préservé tout au long de la migration
- Vendored marked UMD (42KB) dans le plugin pour fiabilité offline

---

## v2.3 Menu Responsive (Shipped: 2026-03-15)

**Phases completed:** 2 phases, 3 plans
**Timeline:** 3 days (2026-03-12 → 2026-03-15)

**Key accomplishments:**
- MUI Drawer bottom pour mobile (auto-height, drag handle, swipe-to-close)
- Push navigation sous-menus (remplace la liste, bouton retour)
- Prompt input pleine largeur dans le drawer

---

## v2.2 Ameliorations UX (Shipped: 2026-03-11)

**Phases completed:** 2 phases, 3 plans, 6 tasks
**Timeline:** 2 days (2026-03-10 → 2026-03-11)
**Commits:** 5 | **Files modified:** 13 (+782 / -70 lines)

**Key accomplishments:**
- Raccourci Ctrl+Shift+I — évite le conflit avec l'italique natif OO
- Ordre des boutons résultat corrigé — Insert à gauche, Replace à droite, Tab naturel
- Suppression du highlight menu à l'ouverture — mousemove gating empêche les faux survols
- Tooltip bouton flottant avec délai 1s — timer cleanup sur leave/unmount/visibility
- Panneau de résultat déplaçable — drag sur fond/header avec exclusion DOM des zones interactives
- Panneau de résultat redimensionnable — grip handle en bas à droite avec reflow du contenu

---

## v2.1 Formatage Riche (Shipped: 2026-03-09)

**Phases completed:** 4 phases, 6 plans, ~13 tasks
**Timeline:** 3 days (2026-03-06 → 2026-03-09)
**Commits:** 33 | **Files modified:** 44 (+5,943 / -187 lines)

**Key accomplishments:**
- Extraction HTML depuis OO — GetSelectedContent avec class stripping et fallback texte brut
- Pipeline de conversion bidirectionnelle — Turndown (HTML→MD) + marked (MD→HTML) avec nettoyage OO
- Rendu Markdown dans le panneau de résultat — react-markdown + remark-gfm, thème MUI (dark/light)
- Réinjection formatée via PasteHtml — Replace et Insert After avec smart spacing (nbsp) et fallback PasteText
- Round-trip complet vérifié — gras, italique, titres, listes, tableaux, code blocks survivent le cycle OO→LLM→OO
- 14/14 requirements satisfaits, UAT 5/5 passé

---

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

