# Scribe pour OnlyOffice

## What This Is

Un assistant d'écriture IA intégré à OnlyOffice au sein de Cozy Drive. Deux modes d'interaction : (1) **Inline** — bouton flottant → actions rapides (réécriture, traduction, correction, prompt libre) → prévisualisation → replace/insert. (2) **Side Panel** — panneau latéral conversationnel pour des échanges plus riches avec l'IA, avec zone de saisie enrichie (sélection OO, contexte, choix modèle/agent) et historique de conversation. Les appels IA passent par cozy-stack (format OpenAI), avec gestion d'erreurs et retry. L'interface est internationalisée (fr, en, de, es, it). La navigation clavier et les micro-interactions sont soignées (raccourci Ctrl+Shift+I, hover gating, tooltip delayed).

## Core Value

L'utilisateur peut interagir avec l'IA de manière fluide — que ce soit via des actions rapides inline ou un chat conversationnel dans un panneau latéral — pour transformer, enrichir et manipuler le contenu de son document OnlyOffice.

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
- ✓ Extraction HTML formaté depuis OO (GetSelectedContent + class stripping + fallback) — v2.1
- ✓ Conversion bidirectionnelle HTML↔Markdown (Turndown + marked) — v2.1
- ✓ Rendu Markdown dans le panneau de résultat (react-markdown + remark-gfm) — v2.1
- ✓ Réinjection formatée via PasteHtml avec smart spacing et fallback PasteText — v2.1
- ✓ Round-trip complet : formatage inline, blocs, tableaux, liens, code survivent le cycle — v2.1
- ✓ Raccourci Ctrl+Shift+I sans conflit avec italique OO — v2.2
- ✓ Ordre de focus clavier naturel (Insert → Replace) dans le panneau de résultat — v2.2
- ✓ Menu hover prevention à l'ouverture (mousemove gating) — v2.2
- ✓ Fenêtre de résultat déplaçable par drag sur fond/header — v2.2
- ✓ Fenêtre de résultat redimensionnable via grip handle — v2.2
- ✓ Tooltip bouton flottant avec délai 1s — v2.2
- ✓ Menu Scribe responsive : bottom drawer sur mobile (breakpoint isMobile cozy-ui) — v2.3
- ✓ Navigation push pour sous-menus dans le drawer (remplace la liste, bouton retour) — v2.3
- ✓ Prompt input adaptatif à la largeur du drawer — v2.3
- ✓ Pré-scan sélection OO : callCommand produit du markdown enrichi avec marqueurs — v2.5
- ✓ Images round-trip : marqueurs + Copy/AddDrawing (image ne quitte jamais OO) — v2.5
- ✓ Tableaux round-trip : [TABLE:N][CELL:r,c] + clone ApiTable.Copy() + InsertContent — v2.5
- ✓ Contrat marqueurs Scribe : syntaxe normalisée pour images et cellules tableau — v2.5
- ✓ Blocs étendus : code blocks, blockquotes, tables markdown via Builder API — v2.5
- ✓ Formatage markdown : state machine buildMarkdownFromParts pour transitions correctes — v2.5
- ✓ Contrat JSON `{discussion, fragments[]}` parsé/validé (validation maison, zéro dépendance) — v3.1
- ✓ Repli contextuel sur réponse non conforme (chat → discussion + filet ; inline → brut = unique fragment) — v3.1
- ✓ Marqueurs `{{fragment:N}}` REF-safe (préservation des cross-refs) — v3.1
- ✓ Cartes de fragment dans le chat (Copier/Insérer/Remplacer + navigation clavier) — v3.1
- ✓ Popover inline rend le fragment unique en carte + menu d'actions refondu — v3.1
- ✓ Échange inline miroité dans l'historique chat partagé — v3.1
- ✓ Sonde dev + métriques de conformité (HARD GATE avant rendu) — v3.1
- ✓ Durcissement contrat : re-ask LLM unique, corpus de régression, décision `response_format` documentée — v3.1
- ✓ i18n cartes + repli sur 5 locales (fr/en/de/es/it), zéro chaîne en dur — v3.1

### Active

- [ ] Souligné (underline) : formatage inline à supporter dans le round-trip
- [ ] Sélections partielles de tableaux : gestion des cas où le tableau n'est pas entièrement sélectionné
- [ ] Notes de bas de page : détection et préservation des renvois vers des notes
- [ ] Renvois vers des parties du document : détection et préservation des cross-références

### Out of Scope

- Développement du moteur IA Scribe (backend) — service existant, on consomme son API
- Migration de l'interface Scribe vers une application Cozy séparée — projet ultérieur (v4.0)
- Support mobile natif — web-first, Cozy Drive est une application web
- Édition collaborative simultanée avec Scribe — complexité excessive
- Correction grammaticale passive en temps réel (style Grammarly) — performance prohibitive

## Current State

**v3.1 Contrat de réponse structurée LLM (MCP-ready) shipped 2026-06-24.** Un contrat JSON `{ discussion, fragments[] }` (MCP-ready, sans serveur) sépare désormais sans ambiguïté ce que le LLM *dit* (discussion) de ce qu'il *produit* à insérer (fragments), de bout en bout sur les deux surfaces :

- **Chat** : la discussion s'affiche en prose, chaque fragment dans une carte encadrée (positions `{{fragment:N}}`) avec Copier/Insérer/Remplacer + navigation clavier complète.
- **Popover inline** : le fragment unique rendu en carte (sans discussion), menu d'actions refondu (prompt libre intégré + entrée « Ouvrir le panneau latéral »).
- **Contrat durci** : parser tolérant zéro-dépendance qui ne lève jamais, repli contextuel par surface, re-ask correctif unique avant repli, corpus de régression vert, `response_format: json_object` par défaut (proxy cozy-stack confirmé forwarder le body inchangé).
- **i18n** : parité de clés Scribe.* 46/46 sur fr/en/de/es/it, aucune chaîne en dur dans les surfaces popover/chat (gates Jest de parité + audit de littéraux).

Prochain milestone en cours : **v3.2 Contexte enrichi du prompt** (démarré 2026-06-24 ; 2/3 phases livrées : v3.2-01 UX statique + v3.2-02 câblage discussion/sélection — reste v3.2-03 document complet). Pistes ultérieures : sortie structurée native `json_schema` (NATIVE-01), actions groupées « tout insérer » (BULK-01), centralisation des prompts IA (backlog 999.1).

## Next Milestone Goals — v3.2 Contexte enrichi du prompt (en cours)

**Goal:** Permettre à l'utilisateur d'enrichir le prompt LLM avec, au choix, le document docx complet, l'historique de discussion, ou la sélection courante — d'abord via une UX discrète dans le side panel (zone « Inclure » + 3 cases à cocher au-dessus du prompt), puis par l'injection réelle des contextes cochés dans le prompt. Approche UX d'abord (statique), puis câblage LLM de bout en bout.

**Scope:** UX + câblage LLM complet (capacité de bout en bout, pas seulement l'UX).

**Phases (3) :**
- ✅ **v3.2-01 — Zone « Inclure » discrète (UX statique)** : zone discrète + 3 cases (« document » / « discussion » / « sélection ») au-dessus du prompt, états par défaut, apparition conditionnelle de la sélection, réutilisation du chip de sélection ; aucun câblage LLM. _(CTX-UX-01..05 — livré 2026-06-24)_
- ✅ **v3.2-02 — Câblage discussion + sélection** : injection déterministe des contextes discussion et sélection (sources « bon marché » déjà en mémoire), sans casser le contrat de réponse v3.1. _(CTX-LLM-02/03/05 — livré 2026-06-25, vérifié 10/10)_
- **v3.2-03 — Câblage document complet + stratégie de taille** : nouveau chemin d'extraction document-entier (markdown) côté plugin + stratégie de troncature documentée + retour utilisateur si tronqué. _(CTX-LLM-01/04)_

**Contrainte UX dure :** les cases à cocher doivent rester visuellement discrètes — ne pas alourdir le panel.
**Contrainte technique clé :** la composition des contextes ne doit jamais altérer le contrat de réponse structurée v3.1 (séparation discussion/fragments) ni le repli/re-ask. L'extraction du document complet est un nouveau chemin (le pipeline actuel n'extrait que la sélection) — d'où l'isolement de la phase docx et de sa stratégie de taille.

Détail complet : `.planning/ROADMAP.md` (§ Phase Details → v3.2) et `.planning/REQUIREMENTS.md`.

## Shipped: v3.1 Contrat de réponse structurée LLM (MCP-ready) (2026-06-24)

**Goal:** Séparer sans ambiguïté la méta-discussion du contenu insérable dans les réponses du LLM, via un contrat JSON (formalisme JSON Schema, MCP-ready), exploité dans le chat et le popover. 7 phases (v3.1-01 à v3.1-07), 19 plans, 19/19 requirements. Voir `.planning/MILESTONES.md` et `.planning/milestones/v3.1-ROADMAP.md`.

## Shipped: v3.0 Scribe Chat Panel (2026-04-04)

**Goal:** Ajouter un panneau latéral conversationnel dans Cozy Drive pour interagir avec l'IA via un chat, en complément du mode inline existant.

**Target features:**
- Panneau latéral dans Cozy Drive (redimensionne l'iframe OO)
- Toggle inline ↔ side panel
- Zone de saisie enrichie : rappel sélection OO, actions suggérées, ajout de contexte (fichiers, URLs, images), choix modèle/agent
- Historique conversationnel (prompts + réponses)
- Historique des discussions passées avec reprise
- Réponses LLM conversationnelles avec boutons d'action conditionnels (replace/insert décidés par le LLM)
- Composants cozy-ui au maximum (sans modification)
- Approche incrémentale

## Shipped: v2.2 Améliorations UX (2026-03-11)

Navigation clavier, interactions souris et micro-interactions : Ctrl+Shift+I, focus order, hover gating, tooltip delay, panneau déplaçable et redimensionnable. 6/6 requirements, 2 phases, 3 plans. Voir `.planning/MILESTONES.md`.

## Shipped: v2.1 Formatage Riche (2026-03-09)

Pipeline de formatage riche complet : extraction HTML depuis OO, conversion bidirectionnelle HTML↔Markdown (Turndown/marked), rendu Markdown dans le panneau de résultat (react-markdown), réinjection via PasteHtml avec smart spacing. 14/14 requirements, 4 phases, 6 plans. Voir `.planning/MILESTONES.md`.

## Shipped: v2.0 Scribe Live AI (2026-03-06)

Intégration LLM réelle via cozy-stack, gestion d'erreurs avec retry, internationalisation 5 locales.
3 phases, 5 plans, 24 commits. Voir `.planning/MILESTONES.md` pour le détail.

**Repo unique:** `~/Dev-local/cozy-drive` — frontend uniquement, pas de modification cozy-stack

## Context

### Shipped v2.3

~2,000+ LOC Scribe module (React/Stylus + OO plugin ES5). 17 phases, 25 plans across 5 milestones.
Tech stack : React 18 + MUI + cozy-ui + twake-i18n, cozy-stack AI proxy, postMessage protocol, OO Plugin API, Turndown, marked, react-markdown, remark-gfm.
v1.0 : 4 jours, 10 plans. v2.0 : 3 jours, 5 plans. v2.1 : 3 jours, 6 plans. v2.2 : 2 jours, 3 plans.

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

- Post-paste selection non fonctionnelle avec PasteHtml (deferred to rich content milestone)

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
| Interface dans le repo Cozy Drive | Simplifier le dev initial | ✓ Good — migration prévue en v4.0 |
| Bouton flottant via React portal | Éviter les conflits z-index avec iframe OO | ✓ Good — positionnement fiable |
| SCRIBE_ACTIONS config déclarative | Source de vérité unique menu + prompts + transform | ✓ Good — extensibilité confirmée |
| mockResult DSL string-based | Sérialisable, prêt pour stockage JSON futur | ✓ Good — transition API facile |
| Plugin type "panel" pour le POC | Panneaux latéraux, non-bloquant | ⚠️ Revisit — bouton flottant a remplacé le panneau |
| fetchJSON direct au lieu de chatCompletion() | Support AbortController signal | ✓ Good — annulation fiable |
| Non-streaming pour v2.0 | Streaming déféré, simplifier l'intégration initiale | ✓ Good — fonctionnel, streaming en v3.x |
| Duck-typed FetchError (err.name) | Détection cross-module sans import | ✓ Good — classification d'erreurs robuste |
| labelKey pattern pour i18n | Actions déclaratives, résolution t() au render | ✓ Good — zéro chaîne hardcodée |
| 5 locales européennes (fr, en, de, es, it) | Couverture utilisateurs Cozy principaux | ✓ Good — extensible |
| Turndown + marked pour conversion HTML↔MD | Libraries matures, GFM support natif | ✓ Good — conversion fiable |
| Regex class stripping (ES5) | Plugin sandbox interdit DOMParser | ✓ Good — compatible ES5 |
| PasteHtml avec smart nbsp spacing | Préserve formatage, simple à implémenter | ✓ Good — suffisant pour v2.1 |
| react-markdown + remark-gfm pour preview | Rendu MD natif React, support tables GFM | ✓ Good — thème MUI intégré |
| Document Builder API pour v2.4 | PasteHtml insuffisant pour images, tableaux, styles custom — Builder API donne le contrôle élément par élément | ✓ Good — pipeline Builder complet |
| Two selection strategies (v2.4) | InsertContent inline détruit les refs, positions fragiles pour blocs complexes — deux méthodes nécessaires | ✓ Good — selectByRefs + selectByPositions |
| Plugin produit le markdown (v2.5) | Plugin OO mieux placé qu'htmlToMarkdown pour produire du md fidèle avec marqueurs OO-spécifiques | ✓ Good — extraction enrichie fiable |
| Contrat marqueurs Scribe (v2.5) | Scribe impose aux éditeurs la syntaxe pour images et cellules tableau — découplage éditeur/Scribe | ✓ Good — [TABLE:N][CELL:r,c] + [IMG:scribe-img-N] |
| Tableaux : extraction cellule par cellule (v2.5) | Envoyer un tableau md au LLM risque de casser la structure — marqueurs [CELL:r,c] plus fiables | ✓ Good — LLM préserve les marqueurs |
| Tableaux : format formatage = md + font/size du 1er paragraphe (v2.5) | On accepte de perdre couleurs et propriétés exotiques, on conserve bold/italic/etc. via md + police source | ✓ Good — formatage fidèle |
| Tableaux : clone + InsertContent (v2.5) | La modification in-place casse le mode Insert et empêche le texte mixte — clone via ApiTable.Copy() inséré dans content[] | ✓ Good — Replace et Insert fonctionnels |
| Images : Copy() au lieu de ToJSON (v2.5) | ToJSON perd le bitmap (image blanche), Copy() préserve le contenu | ✓ Good — images fidèles |
| OO SDK patch GetInlineDrawings (v2.5) | L'API plugin n'expose pas la position des drawings inline — PR upstream #4868 | ⚠ Pending upstream — polyfill via SDK patché |
| buildMarkdownFromParts (v2.5) | formatRun wrappait chaque run indépendamment → md invalide. State machine pour transitions de formatage + trailing whitespace fix (CommonMark) | ✓ Good — md valide, liens formatés |
| Ctrl+Shift+I pour raccourci Scribe | Évite conflit avec Ctrl+I (italique natif OO) | ✓ Good — aucun conflit OO |
| mousemove gating pour hover menu | Détecte mouvement physique vs ouverture sous curseur | ✓ Good — zéro faux highlight |
| showTooltip séparé de hovered | Opacité instantanée, tooltip retardé indépendamment | ✓ Good — UX naturelle |
| DOM walk exclusion pour drag | Exclut boutons/input/texte sans drag handle séparé | ✓ Good — zones interactives préservées |
| Resize via inline width/height + flex | Meilleur contrôle et clamping que CSS resize | ✓ Good — reflow contenu fiable |

| Side panel dans Cozy Drive (pas plugin OO natif) | Plus de contrôle UI, composants cozy-ui, redimensionnement iframe OO | ✓ Good -- flex sibling layout, OO iframe resizes correctly |
| Mode complémentaire inline + panel | Conserver les quick actions, ajouter le chat pour échanges longs | ✓ Good -- both modes coexist, shared conversation history |
| Composants cozy-ui sans modification | Cohérence écosystème Cozy, maintenabilité | ✓ Good -- cozy-ui used throughout v3.0 |
| SELECTION_CHANGED remplace SHOW/HIDE polling (v3.0) | Polling causait latence et complexité inutile -- intent one-way plus simple | ✓ Good -- sélection live, zéro polling |
| Selection-subscribe protocol (v3.0) | Plugin n'envoie SELECTION_CHANGED que quand le panel est ouvert -- réduit le bruit | ✓ Good -- performant, pas de messages inutiles |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-25 — v3.2-02 (câblage discussion + sélection) complete & verified; 2/3 v3.2 phases done*
