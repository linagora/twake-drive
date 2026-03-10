# Requirements: Scribe v2.2 Ameliorations UX

**Defined:** 2026-03-10
**Core Value:** La chaine de communication complete -- depuis la selection de texte dans OnlyOffice jusqu'a la reinjection du texte modifie par l'IA -- de bout en bout, transparente pour l'utilisateur.

## v2.2 Requirements

Requirements pour le milestone v2.2 Ameliorations UX.

### Navigation & Clavier

- [ ] **NAV-01**: L'utilisateur peut ouvrir Scribe avec Ctrl+Shift+I (au lieu de Ctrl+I qui declenche la mise en italique)
- [ ] **NAV-02**: Dans le panneau de resultat, Tab et fleche droite passent de Inserer a Remplacer (ordre de focus inverse par rapport a l'actuel)

### Interactions Souris

- [ ] **MOUSE-01**: A l'ouverture du menu, un item sous la souris n'est pas selectionne tant que la souris ne se deplace pas vers un autre item
- [ ] **MOUSE-02**: L'utilisateur peut deplacer la fenetre de resultat en cliquant-glissant sur le fond (hors boutons et zone de texte)
- [ ] **MOUSE-03**: L'utilisateur peut redimensionner la fenetre de resultat via un handle discret en bas a droite

### Micro-interactions

- [ ] **MICRO-01**: Le tooltip du bouton flottant Scribe n'apparait qu'apres 1 seconde de survol continu

## Future Requirements

### Carried from v2.1

- Post-paste selection positioning (deferred to rich content milestone)
- OO dark theme systematic testing
- Button disable on deselection when no text selected
- Context menu integration testing

### Carried from v2.1 Out of Scope

- **EDIT-01**: Editeur MD editable dans le panneau de resultat
- **STRM-01**: Streaming token par token avec rendu incremental
- **DIFF-01**: Vue diff entre texte original et resultat AI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Streaming LLM responses | Defere a v3.x -- non-streaming suffisant |
| Document Builder API | Defere a v3.x -- PasteHtml suffisant pour v2.x |
| Migration vers application Cozy separee | Projet v3.0 |
| Mobile natif | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 14 | Pending |
| NAV-02 | Phase 14 | Pending |
| MOUSE-01 | Phase 14 | Pending |
| MOUSE-02 | Phase 15 | Pending |
| MOUSE-03 | Phase 15 | Pending |
| MICRO-01 | Phase 14 | Pending |

**Coverage:**
- v2.2 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation*
