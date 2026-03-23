# Requirements: Scribe pour OnlyOffice

**Defined:** 2026-03-23
**Core Value:** La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — de bout en bout, transparente pour l'utilisateur.

## v2.6 Requirements

### Formatage Inline

- [ ] **FMT-01**: Le souligné (underline) dans la sélection OO est extrait comme markdown et réinjecté avec le formatage préservé

### Sélections Partielles de Tableaux

- [ ] **TBL-01**: Quand la sélection ne couvre qu'une partie d'un tableau (lignes/colonnes partielles), Scribe traite correctement les cellules sélectionnées sans casser la structure du tableau
- [ ] **TBL-02**: Scribe détecte et signale à l'utilisateur quand la sélection coupe un tableau de manière ambiguë

### Références Documentaires

- [ ] **REF-01**: Les notes de bas de page dans la sélection sont détectées et préservées dans le round-trip (le contenu peut être modifié, le renvoi reste intact)
- [ ] **REF-02**: Les renvois vers des parties du document (cross-références internes) dans la sélection sont détectés et préservés dans le round-trip

## Future Requirements

Aucun pour le moment.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Couleurs de texte | Pas de syntaxe markdown standard pour les couleurs — déféré |
| Tables imbriquées | Complexité excessive pour v2.6 |
| Création de tableaux par le LLM | Le LLM ne peut pas créer de nouveaux tableaux, seulement modifier le contenu des cellules existantes |
| Images dans les notes de bas de page | Cas marginal, pas prioritaire |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FMT-01 | Phase 25 | Pending |
| TBL-01 | Phase 26 | Pending |
| TBL-02 | Phase 26 | Pending |
| REF-01 | Phase 27 | Pending |
| REF-02 | Phase 27 | Pending |

**Coverage:**
- v2.6 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after roadmap creation*
