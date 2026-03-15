# Requirements: Scribe pour OnlyOffice

**Defined:** 2026-03-15
**Core Value:** La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — de bout en bout, transparente pour l'utilisateur.

## v2.4 Requirements

Requirements for milestone v2.4 Document Builder Injection. Each maps to roadmap phases.

### Parser & Pipeline

- [ ] **PARSE-01**: Le plugin OO parse le Markdown retourné par le LLM via marked (bundlé dans code.js) et produit des tokens structurés
- [ ] **PARSE-02**: Les tokens sont passés via Asc.scope à callCommand qui les interprète en appels Document Builder API
- [ ] **PARSE-03**: L'interface entre Scribe (React) et le plugin reste du Markdown brut (aucune dépendance à un format de tokens spécifique)

### Inline Formatting

- [ ] **INL-01**: Le texte **gras**, *italique* et ***gras+italique*** est injecté avec le formatage OO correspondant (SetBold, SetItalic)
- [ ] **INL-02**: Le texte ~~barré~~ est injecté avec le formatage OO correspondant (SetStrikeout)
- [ ] **INL-03**: Les `code spans` sont injectés en police monospace (SetFontFamily)
- [ ] **INL-04**: Les liens [texte](url) sont injectés comme des hyperliens OO cliquables

### Block Elements

- [ ] **BLK-01**: Les paragraphes multiples sont injectés comme des paragraphes OO séparés (pas un seul bloc avec retours à la ligne)
- [ ] **BLK-02**: Les headings (# à ######) sont injectés avec les styles heading OO correspondants
- [ ] **BLK-03**: Les listes à puces (- item) sont injectées comme des listes OO avec numérotation bullet, y compris les listes imbriquées (niveaux d'indentation)
- [ ] **BLK-04**: Les listes numérotées (1. item) sont injectées comme des listes OO avec numérotation ordonnée, y compris les listes imbriquées

### Injection Behavior

- [ ] **INJ-01**: Toute l'injection se fait en un seul callCommand (un seul point d'undo Ctrl+Z)
- [ ] **INJ-02**: Après injection, le contenu injecté est entièrement sélectionné dans OO
- [ ] **INJ-03**: Des espaces sont ajoutés intelligemment en début/fin pour le remplacement, et des retours à la ligne pour l'insertion, selon le contexte adjacent

## Future Requirements

### Tables & Structures complexes
- **TBL-01**: Les tableaux GFM sont injectés comme des tableaux OO avec structure de colonnes
- **TBL-02**: Les code blocks multi-lignes sont injectés en police monospace
- **TBL-03**: Les blockquotes sont injectés avec indentation/bordure visuelle

### Format Preservation
- **FMT-01**: Les propriétés du document d'origine (font, taille, couleur) sont capturées avant envoi au LLM et réappliquées à l'injection

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fallback PasteHtml automatique | Pas de cas d'échec Builder constaté — à ajouter si nécessaire |
| Injection d'images via Builder API | Timing issues confirmés dans callCommand (bug OO communauté) |
| Streaming injection (progressive rendering) | Casse le single undo point, déféré à v3.x |
| Syntax highlighting dans code blocks | OO n'a pas d'API de coloration syntaxique |
| Cellules fusionnées / styles par cellule | Le Markdown GFM ne peut pas les représenter |
| Conversion HTML → Builder (bypass MD) | Complexité excessive, le LLM retourne du MD |
| Preservation styles originaux (font/color) | Déféré — stratégie snapshot/fusion à explorer en milestone suivante |
| Desktop menu redesign | Pas lié à cette milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmapper) | | |

**Coverage:**
- v2.4 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14 ⚠️

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after initial definition*
