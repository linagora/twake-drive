# Requirements: Scribe pour OnlyOffice

**Defined:** 2026-02-26
**Core Value:** La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié — doit fonctionner de bout en bout.

## v1 Requirements

### Plugin OnlyOffice (POC)

- [ ] **PLUG-01**: Le plugin OnlyOffice se charge dans l'éditeur et peut exécuter du code
- [ ] **PLUG-02**: Le plugin détecte quand l'utilisateur sélectionne du texte dans le document
- [ ] **PLUG-03**: Le plugin peut lire le texte sélectionné par l'utilisateur
- [ ] **PLUG-04**: Le plugin peut remplacer le texte sélectionné par un nouveau texte
- [ ] **PLUG-05**: Le plugin peut insérer du texte après la sélection avec un retour à la ligne
- [ ] **PLUG-06**: Un bouton contextuel "Scribe" apparaît quand du texte est sélectionné

### Communication

- [ ] **COMM-01**: Le plugin OnlyOffice communique avec Cozy Drive via postMessage
- [ ] **COMM-02**: Cozy Drive gère l'ouverture/fermeture de l'interface Scribe
- [ ] **COMM-03**: L'interface Scribe reçoit le texte sélectionné depuis le plugin

### Interface Scribe (rudimentaire)

- [ ] **UI-01**: Interface HTML/JS basique (pas de React/cozy-ui pour l'instant)
- [ ] **UI-02**: Affichage du texte sélectionné dans l'interface
- [ ] **UI-03**: Bouton pour déclencher la transformation mock (pas d'API IA réelle)
- [ ] **UI-04**: Prévisualisation du résultat de la transformation
- [ ] **UI-05**: Bouton "Remplacer" pour substituer le texte original dans le document
- [ ] **UI-06**: Bouton "Insérer" pour ajouter le résultat après la sélection (avec retour à la ligne)
- [ ] **UI-07**: Bouton "Annuler" pour fermer l'interface sans appliquer de modification

### Mock IA

- [ ] **MOCK-01**: Transformation mock : ajouter du texte au début et à la fin du bloc, préfixer chaque ligne avec `$ `

## v2 Requirements

### Interface Scribe (version cible)

- **UI-V2-01**: Interface React avec composants cozy-ui
- **UI-V2-02**: Prévisualisation éditable (modifier le résultat avant application)
- **UI-V2-03**: Diff visuel entre l'original et le résultat IA
- **UI-V2-04**: Réponse streaming en temps réel

### Actions IA (intégration API réelle)

- **IA-01**: Intégration avec l'API Scribe réelle (remplacement du mock)
- **IA-02**: Réécriture / Reformulation
- **IA-03**: Correction grammaticale / orthographique
- **IA-04**: Prompt libre (instruction personnalisée)
- **IA-05**: Ajustement de ton (formel, casual, professionnel)
- **IA-06**: Allonger / Raccourcir le texte
- **IA-07**: Traduction (choix de langue cible)

### Fonctionnalités avancées

- **ADV-01**: Mémoire de conversation (raffinement itératif)
- **ADV-02**: Préservation du formatage riche (gras, italique, etc.)
- **ADV-03**: Cycle accepter / rejeter / régénérer complet

## Out of Scope

| Feature | Reason |
|---------|--------|
| Développement du moteur IA Scribe (backend) | Service existant, on consomme son API |
| Génération de document complet | Paradigme différent de la transformation de sélection |
| Correction grammaticale passive en temps réel (style Grammarly) | Nécessite analyse continue du document entier, performance prohibitive |
| Agents IA autonomes | Contradictoire avec le principe de prévisualisation/contrôle utilisateur |
| Sélection de modèle IA | Le backend gère le choix du modèle côté serveur |
| Résumé de document | Déjà implémenté dans Cozy Drive via SummarizeByAIButton |
| Génération d'images / OCR | Hors périmètre, cas d'usage différent |
| Migration vers app Cozy séparée | Projet ultérieur |
| Support mobile natif | Application web uniquement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLUG-01 | Phase 1 | Pending |
| PLUG-02 | Phase 1 | Pending |
| PLUG-03 | Phase 1 | Pending |
| PLUG-04 | Phase 1 | Pending |
| PLUG-05 | Phase 1 | Pending |
| PLUG-06 | Phase 1 | Pending |
| COMM-01 | Phase 2 | Pending |
| COMM-02 | Phase 2 | Pending |
| COMM-03 | Phase 2 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| MOCK-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
