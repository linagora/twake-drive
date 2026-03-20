# Requirements: Scribe pour OnlyOffice

**Defined:** 2026-03-20
**Core Value:** La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — de bout en bout, transparente pour l'utilisateur.

## v2.5 Requirements

Requirements for Objets Complexes et Blocs Étendus. Each maps to roadmap phases.

### Extraction

- [x] **EXTR-01**: Le plugin OO scanne la sélection via callCommand et produit du markdown enrichi avec marqueurs (au lieu de htmlToMarkdown)
- [ ] **EXTR-02**: Les images dans la sélection sont détectées, nommées (SetName), et remplacées par des marqueurs dans le markdown
- [ ] **EXTR-03**: Les tableaux dans la sélection sont détectés, leur texte est extrait cellule par cellule au format [CELL:r,c]...[/CELL]
- [x] **EXTR-04**: Le pré-scan s'exécute à chaque sélection (proactivement) et envoie le markdown enrichi à Scribe

### Contrat Marqueurs

- [ ] **MARK-01**: Scribe définit une syntaxe pour les images bloc (![IMG:id](placeholder)) et inline ({{IMG:id}})
- [ ] **MARK-02**: Scribe définit une syntaxe pour les cellules tableau ([CELL:r,c]texte[/CELL])
- [ ] **MARK-03**: Scribe parse les marqueurs cellule dans la réponse LLM et valide la cohérence (nombre de cellules)
- [ ] **MARK-04**: Scribe reconstitue un tableau markdown pour l'affichage utilisateur à partir des cellules traduites
- [ ] **MARK-05**: Scribe affiche un placeholder visuel dans le markdown pour indiquer l'emplacement d'une image

### Réinjection

- [ ] **REINJ-01**: Les marqueurs image dans le markdown retour sont remplacés par les images originales (Copy + AddDrawing)
- [ ] **REINJ-02**: Les cellules traduites sont réinjectées dans le tableau OO d'origine (structure préservée : bordures, fonds, largeurs, fusions)
- [ ] **REINJ-03**: Le formatage des cellules réinjectées applique le md (bold/italic/etc.) + font/size du 1er paragraphe source

### Blocs Étendus

- [ ] **BLK-01**: Les code blocks fenced dans le markdown sont injectés comme paragraphes monospace via Builder API
- [ ] **BLK-02**: Les blockquotes dans le markdown sont injectés comme paragraphes indentés via Builder API
- [ ] **BLK-03**: Les tableaux markdown classiques (non marqués) dans le markdown sont injectés comme ApiTable via Builder API

## v2.4 Requirements (Complete)

<details>
<summary>14/14 requirements — shipped 2026-03-20</summary>

### Parser & Pipeline

- [x] **PARSE-01**: Le plugin OO parse le Markdown retourné par le LLM via marked (bundlé dans code.js) et produit des tokens structurés
- [x] **PARSE-02**: Les tokens sont passés via Asc.scope à callCommand qui les interprète en appels Document Builder API
- [x] **PARSE-03**: L'interface entre Scribe (React) et le plugin reste du Markdown brut (aucune dépendance à un format de tokens spécifique)

### Inline Formatting

- [x] **INL-01**: Le texte gras, italique et gras+italique est injecté avec le formatage OO correspondant (SetBold, SetItalic)
- [x] **INL-02**: Le texte barré est injecté avec le formatage OO correspondant (SetStrikeout)
- [x] **INL-03**: Les code spans sont injectés en police monospace (SetFontFamily)
- [x] **INL-04**: Les liens sont injectés comme des hyperliens OO cliquables

### Block Elements

- [x] **BLK-01**: Les paragraphes multiples sont injectés comme des paragraphes OO séparés
- [x] **BLK-02**: Les headings sont injectés avec les styles heading OO correspondants
- [x] **BLK-03**: Les listes à puces sont injectées comme des listes OO avec numérotation bullet
- [x] **BLK-04**: Les listes numérotées sont injectées comme des listes OO avec numérotation ordonnée

### Injection Behavior

- [x] **INJ-01**: Toute l'injection se fait en un seul callCommand (un seul point d'undo Ctrl+Z)
- [x] **INJ-02**: Après injection, le contenu injecté est entièrement sélectionné dans OO
- [x] **INJ-03**: Des espaces sont ajoutés intelligemment en début/fin selon le contexte adjacent

</details>

## Future Requirements

### v3.0 Chat Panel

- **CHAT-01**: Panneau latéral Scribe avec conversation persistante
- **CHAT-02**: Actions popover reflétées dans l'historique chat

## Out of Scope

| Feature | Reason |
|---------|--------|
| Préservation des couleurs de texte dans les cellules | Les couleurs ne survivent pas au round-trip markdown — acceptable pour v2.5 |
| Charts/shapes round-trip | Les LLMs ne produisent pas de charts/shapes — pas pertinent pour l'édition texte |
| Streaming LLM responses | Déféré à v3.x — non-streaming suffisant |
| Image editing/transformation par le LLM | Le LLM ne traite pas les images — on préserve seulement leur position |
| Syntax highlighting dans code blocks | OO n'a pas d'API de coloration syntaxique |
| Cellules fusionnées / styles par cellule (couleurs) | Le Markdown ne peut pas les représenter — on préserve la structure mais pas les couleurs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BLK-01 | Phase 21 | Pending |
| BLK-02 | Phase 21 | Pending |
| BLK-03 | Phase 21 | Pending |
| EXTR-01 | Phase 22 | Complete |
| EXTR-04 | Phase 22 | Complete |
| MARK-01 | Phase 22 | Pending |
| MARK-02 | Phase 22 | Pending |
| EXTR-02 | Phase 23 | Pending |
| MARK-05 | Phase 23 | Pending |
| REINJ-01 | Phase 23 | Pending |
| EXTR-03 | Phase 24 | Pending |
| MARK-03 | Phase 24 | Pending |
| MARK-04 | Phase 24 | Pending |
| REINJ-02 | Phase 24 | Pending |
| REINJ-03 | Phase 24 | Pending |

**Coverage:**
- v2.5 requirements: 15 total
- Mapped to phases: 15/15
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
