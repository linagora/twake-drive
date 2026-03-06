# Requirements: Scribe v2.1 Formatage Riche

**Defined:** 2026-03-06
**Core Value:** La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — de bout en bout, transparente pour l'utilisateur.

## v2.1 Requirements

Requirements for rich text formatting preservation. Each maps to roadmap phases.

### Extraction

- [ ] **EXTR-01**: Le plugin extrait le HTML formaté de la sélection via `GetSelectedContent({type:"html"})`
- [ ] **EXTR-02**: Le protocole postMessage transporte le HTML avec un champ `format:"html"`
- [ ] **EXTR-03**: Si l'extraction HTML échoue, le système revient silencieusement au texte brut

### Conversion

- [ ] **CONV-01**: Le HTML extrait est converti en Markdown via Turndown côté Cozy Drive
- [ ] **CONV-02**: La réponse Markdown du LLM est reconvertie en HTML via marked pour réinjection
- [ ] **CONV-03**: Les éléments non supportés (images, SVG, math) sont nettoyés avant conversion

### Preview

- [ ] **PREV-01**: Le panneau de résultat affiche le Markdown rendu (react-markdown) au lieu du texte brut
- [ ] **PREV-02**: Le rendu Markdown utilise les tokens MUI du thème Scribe (dark/light mode)

### Réinjection

- [ ] **REINJ-01**: L'action "Replace" utilise `PasteHtml` pour réinjecter le texte formaté
- [ ] **REINJ-02**: L'action "Insert After" insère du contenu HTML formaté après la sélection

### Intégrité du pipeline

- [ ] **PIPE-01**: Le formatage inline (gras, italique) survit au cycle complet (extraction → LLM → réinjection)
- [ ] **PIPE-02**: Les blocs (titres, listes à puces/numérotées, paragraphes) survivent au cycle complet
- [ ] **PIPE-03**: Les tableaux GFM survivent au cycle complet
- [ ] **PIPE-04**: Les liens et blocs de code survivent au cycle complet

## Future Requirements

### Édition du résultat

- **EDIT-01**: L'utilisateur peut modifier le résultat Markdown dans le panneau avant insertion (éditeur MD éditable)

### Streaming

- **STRM-01**: Affichage progressif token par token avec rendu Markdown incrémental

### Comparaison

- **DIFF-01**: Vue diff entre le texte original et le résultat AI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Préservation font/color/size custom | Markdown n'a pas de concept de polices, tailles ou couleurs — nécessiterait un pipeline HTML parallèle |
| Extraction/réinjection d'images | Les images ne survivent pas au round-trip LLM (text completion) |
| Track changes / marques de révision | Mélanger IA et tracked changes crée une confusion dans l'historique |
| Math/équations (LaTeX, MathML) | Complexité élevée pour un cas d'usage niche |
| Fusion formatage original + LLM | Problème de diffing non résolu — le MD du LLM définit le formatage |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXTR-01 | Phase 10 | Pending |
| EXTR-02 | Phase 10 | Pending |
| EXTR-03 | Phase 10 | Pending |
| CONV-01 | Phase 11 | Pending |
| CONV-02 | Phase 11 | Pending |
| CONV-03 | Phase 11 | Pending |
| PREV-01 | Phase 12 | Pending |
| PREV-02 | Phase 12 | Pending |
| REINJ-01 | Phase 13 | Pending |
| REINJ-02 | Phase 13 | Pending |
| PIPE-01 | Phase 13 | Pending |
| PIPE-02 | Phase 13 | Pending |
| PIPE-03 | Phase 13 | Pending |
| PIPE-04 | Phase 13 | Pending |

**Coverage:**
- v2.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after roadmap creation*
