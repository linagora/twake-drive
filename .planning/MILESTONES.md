# Milestones

## v3.1 Contrat de réponse structurée LLM (MCP-ready) (Shipped: 2026-06-24)

**Phases completed:** 7 phases (v3.1-01 to v3.1-07), 19 plans
**Timeline:** 2026-06-16 → 2026-06-24 (9 days)
**Commits:** 123 v3.1-tagged commits (431 total on branch since the v3.1 boundary, incl. an upstream twake/master merge)
**Requirements:** 19/19 satisfied

**Delivered:** Un contrat JSON `{ discussion, fragments[] }` (MCP-ready, sans serveur) sépare sans ambiguïté ce que le LLM *dit* de ce qu'il *produit* à insérer, exploité de bout en bout dans le chat et le popover inline.

**Key accomplishments:**

- Module contrat pur `scribeResponse.js` — `parseScribeResponse` tolérant (fence-strip → premier `{…}` équilibré → réparation virgule traînante → JSON.parse → validation maison) qui ne lève jamais, repli contextuel par surface, grammaire de marqueurs `{{fragment:N}}` REF-safe, `SCRIBE_OUTPUT_SCHEMA` documenté, zéro dépendance
- Plumbing dual-surface — les system prompts (chat + inline) émettent le contrat via un `RESPONSE_CONTRACT_CORE` partagé + cardinalité par surface ; seam de parse aux deux call sites ; modèle de message étendu `{discussion, fragments, fellBack}` ; sérialisation multi-tour n'envoyant que la discussion ; miroir inline → historique chat
- Sonde dev HARD GATE — panneau dev exposant `{discussion, fragments, valid, fellBack, warnings}` + métriques de conformité (duplication, préambule par locale, table non scindée, REF préservés, répartition 0/1/N) ; gate go/no-go PASS (N=46/52) qui a conditionné tout le rendu de cartes
- Rendu chat (cartes + clavier) — chaque fragment en carte encadrée Scribe-violet aux positions `{{fragment:N}}` avec Copier/Insérer/Remplacer (Remplacer gardé par sélection active), réinjection riche par fragment, navigation clavier complète au fil (↑/↓/←/→/Échap/Entrée)
- Rendu popover (UI) — le fragment unique rendu en carte (réutilise FragmentCard/MarkdownPreview, marqueurs propres) sans afficher la discussion ; refonte du menu d'actions (prompt libre intégré comme entrée + entrée « Ouvrir le panneau latéral » remplaçant l'icône)
- Durcissement contrat — helper partagé `callScribeAIWithReask` (re-ask correctif unique sur `fellBack || !valid` avant repli, signal-respecting) ; corpus de régression statique 6 catégories ; fence fellBack re-mesuré à 0% (stripFence confirmé) ; décision `response_format: json_object` documentée (proxy cozy-stack confirmé forwarder le body inchangé)
- i18n 5 locales — parité de clés Scribe.* 46/46 sur fr/en/de/es/it ; 3 littéraux FR en dur extraits vers `t()` ; gates Jest de parité + audit de littéraux ; aucune chaîne Scribe en dur dans les surfaces popover/chat

**Known deferred items at close:** 5 (see STATE.md Deferred Items) — 4 pre-existing human-verify gaps inherited from shipped milestones (phase 21/25 v2.1, v3.0-01/02) + 1 false-positive open flag (`2-feature-flag-for-scribe`, actually completed 2026-03-05).

---

## v3.0 Scribe Chat Panel (Shipped: 2026-04-04)

**Phases completed:** 4 phases, 7 plans
**Timeline:** 2026-03-15 → 2026-04-04 (includes post-milestone refinements)
**Requirements:** 16/16 satisfied

**Key accomplishments:**

- Panneau latéral conversationnel dans Cozy Drive (flex sibling layout, OO iframe resizes)
- Chat multi-turn avec historique, rendu Markdown, gestion d'erreurs
- Sélection OO intégrée au chat (chip + contexte dans le prompt AI)
- Actions sur les réponses AI : Copy, Replace, Insert (via panelActions bridge)
- Panel drag-resizable (ResizeHandle component + dynamic width in ScribeContext)
- Coexistence inline popover + side panel avec historique de conversation partagé
- Post-milestone: simplification protocole plugin (SHOW/HIDE polling → SELECTION_CHANGED), selection-subscribe protocol, suppression des délais (shortcut + popover)
- Documentation SDK patch (upstream PR #4868 GetInlineDrawings)

---

## v2.5 Objets Complexes et Blocs Etendus (Shipped: 2026-03-23)

**Phases completed:** 7 phases, 12 plans
**Timeline:** 2026-03-20 → 2026-03-23 (4 days)
**Commits:** 49 | **LOC:** ~2,100 (code.js + tableCellMarkers.js)

**Key accomplishments:**

- Blocs étendus : code blocks (monospace + dark bg), blockquotes (quote style), tables markdown (ApiTable native)
- Extraction enrichie : plugin OO scanne la sélection et produit du markdown avec marqueurs normalisés [TABLE:N][CELL:r,c] et [IMG:scribe-img-N]
- Image round-trip : images survivent le cycle LLM via Copy() pre-cache + AddDrawing, avec badges dans le preview
- Table round-trip : clone via ApiTable.Copy() + InsertContent mixte [paragraphes + tables], support Replace et Insert
- OO SDK patch : ApiRun.GetInlineDrawings() — PR #4868 upstream sur ONLYOFFICE/sdkjs
- Formatage markdown : state machine buildMarkdownFromParts pour transitions correctes + trailing whitespace CommonMark fix

---

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
