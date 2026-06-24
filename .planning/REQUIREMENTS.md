# Requirements — v3.2 Contexte enrichi du prompt

**Milestone:** v3.2 — Contexte enrichi du prompt
**Defined:** 2026-06-24
**Goal:** Permettre à l'utilisateur d'enrichir le prompt LLM avec, au choix, le document docx complet, l'historique de discussion, ou la sélection courante — d'abord via une UX discrète dans le side panel, puis par l'injection réelle des contextes cochés dans le prompt.

## Requirements

### UX — zone « Inclure » (statique d'abord)

- [ ] **CTX-UX-01**: Une zone « Inclure » apparaît dans le side panel, au-dessus du prompt, contenant trois cases à cocher : « document », « discussion », « sélection ».
- [ ] **CTX-UX-02**: Les cases « document » et « discussion » sont décochées par défaut.
- [ ] **CTX-UX-03**: La case « sélection » n'apparaît que lorsqu'une sélection active existe dans le document ; elle est cochée par défaut dès qu'une sélection existe.
- [ ] **CTX-UX-04**: Cocher « sélection » fait apparaître la zone d'affichage de la sélection courante (réutilise le chip/zone de sélection existant) ; la décocher la masque.
- [ ] **CTX-UX-05**: Les cases à cocher sont visuellement **discrètes** — elles n'alourdissent pas l'UI du panel (taille réduite, intégration légère au-dessus du prompt, cohérente avec le thème clair/sombre).

### Câblage LLM — injection des contextes

- [ ] **CTX-LLM-01**: Quand « document » est coché, le contenu du docx complet (extrait en markdown via le pipeline existant) est injecté dans le prompt envoyé au LLM.
- [ ] **CTX-LLM-02**: Quand « discussion » est coché, l'historique de conversation pertinent est inclus dans le prompt.
- [ ] **CTX-LLM-03**: Quand « sélection » est coché, la sélection courante est incluse dans le prompt de façon explicite et formalisée.
- [ ] **CTX-LLM-04**: La taille du contexte injecté est maîtrisée — une stratégie de limite/troncature (notamment pour le docx complet, potentiellement volumineux) est décidée et documentée, avec un retour utilisateur si le contexte est tronqué.
- [ ] **CTX-LLM-05**: La composition des contextes inclus est déterministe et **n'altère pas le contrat de réponse structurée v3.1** (séparation discussion/fragments préservée) ni le comportement de repli/re-ask.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTX-UX-01 | v3.2-01 | Pending |
| CTX-UX-02 | v3.2-01 | Pending |
| CTX-UX-03 | v3.2-01 | Pending |
| CTX-UX-04 | v3.2-01 | Pending |
| CTX-UX-05 | v3.2-01 | Pending |
| CTX-LLM-02 | v3.2-02 | Pending |
| CTX-LLM-03 | v3.2-02 | Pending |
| CTX-LLM-05 | v3.2-02 | Pending |
| CTX-LLM-01 | v3.2-03 | Pending |
| CTX-LLM-04 | v3.2-03 | Pending |

**Coverage:**
- v3.2 requirements: 10 total
- Mapped to phases: 10 (v3.2-01: 5 UX | v3.2-02: 3 wiring | v3.2-03: 2 wiring)
- Unmapped: 0
