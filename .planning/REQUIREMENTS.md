# Requirements: Scribe v2.2 Améliorations UX

**Defined:** 2026-03-10
**Core Value:** La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — de bout en bout, transparente pour l'utilisateur.

## v2.2 Requirements

Requirements pour le milestone v2.2 Améliorations UX.

### Navigation & Clavier

- [ ] **NAV-01**: L'utilisateur peut ouvrir Scribe avec Ctrl+Shift+I (au lieu de Ctrl+I qui déclenche la mise en italique)
- [ ] **NAV-02**: Dans le panneau de résultat, Tab et flèche droite passent de Insérer à Remplacer (ordre de focus inversé par rapport à l'actuel)

### Interactions Souris

- [ ] **MOUSE-01**: À l'ouverture du menu, un item sous la souris n'est pas sélectionné tant que la souris ne se déplace pas vers un autre item
- [ ] **MOUSE-02**: L'utilisateur peut déplacer la fenêtre de résultat en cliquant-glissant sur le fond (hors boutons et zone de texte)
- [ ] **MOUSE-03**: L'utilisateur peut redimensionner la fenêtre de résultat via un handle discret en bas à droite

### Micro-interactions

- [ ] **MICRO-01**: Le tooltip du bouton flottant Scribe n'apparaît qu'après 1 seconde de survol continu

## Future Requirements

### Carried from v2.1

- Post-paste selection positioning (deferred to rich content milestone)
- OO dark theme systematic testing
- Button disable on deselection when no text selected
- Context menu integration testing

### Carried from v2.1 Out of Scope

- **EDIT-01**: Éditeur MD éditable dans le panneau de résultat
- **STRM-01**: Streaming token par token avec rendu incrémental
- **DIFF-01**: Vue diff entre texte original et résultat AI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Streaming LLM responses | Déféré à v3.x — non-streaming suffisant |
| Document Builder API | Déféré à v3.x — PasteHtml suffisant pour v2.x |
| Migration vers application Cozy séparée | Projet v3.0 |
| Mobile natif | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| MOUSE-01 | — | Pending |
| MOUSE-02 | — | Pending |
| MOUSE-03 | — | Pending |
| MICRO-01 | — | Pending |

**Coverage:**
- v2.2 requirements: 6 total
- Mapped to phases: 0
- Unmapped: 6 ⚠️

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
