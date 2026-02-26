# Scribe pour OnlyOffice

## What This Is

Un assistant d'édition de texte intégré à OnlyOffice au sein de Cozy Drive. L'utilisateur sélectionne du texte dans l'éditeur, déclenche Scribe via un bouton contextuel, choisit une action IA (réécriture, traduction, amélioration, correction…), prévisualise le résultat, puis le remplace ou l'insère dans le document.

## Core Value

La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — doit fonctionner de bout en bout, de manière transparente pour l'utilisateur.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Cozy Drive ouvre des documents dans OnlyOffice via iframe — existing
- ✓ Environnement de dev local fonctionnel (Cozy Drive + OnlyOffice Docker) — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Plugin OnlyOffice capable de détecter la sélection de texte dans l'éditeur
- [ ] Bouton contextuel "Scribe" affiché à la fin de la sélection de texte
- [ ] Communication bidirectionnelle entre le plugin OnlyOffice et l'iframe Scribe (via postMessage)
- [ ] Iframe Scribe superposée à l'éditeur OnlyOffice, pilotée par Cozy Drive
- [ ] Interface Scribe avec menu d'actions d'édition IA (améliorer, reformuler, traduire, corriger, prompt libre)
- [ ] Envoi du texte sélectionné + instruction au moteur IA Scribe (API existante)
- [ ] Prévisualisation du texte modifié dans l'interface Scribe avant application
- [ ] L'utilisateur peut modifier le texte proposé avant de l'appliquer
- [ ] Action "Remplacer" : le texte modifié remplace la sélection originale dans le document
- [ ] Action "Insérer" : le texte modifié est ajouté après la sélection originale (avec retour à la ligne)
- [ ] Préservation du formatage du texte lors de l'extraction et la réinjection (niveau déterminé par le POC)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Développement du moteur IA Scribe (backend) — service existant, on consomme son API
- Migration de l'interface Scribe vers une application Cozy séparée — projet ultérieur
- Support mobile natif — web-first, Cozy Drive est une application web
- Édition collaborative simultanée avec Scribe — complexité excessive pour v1

## Context

### Architecture à 4 couches

1. **Cozy Drive (application hôte)** — héberge l'iframe OnlyOffice et l'iframe Scribe, orchestre leur affichage et leur cycle de vie
2. **Plugin OnlyOffice** — déployé dans OnlyOffice Document Server, détecte la sélection, affiche le bouton contextuel, lit/écrit dans le document
3. **Iframe Scribe (interface)** — contenue dans Cozy Drive (contenu provenant du même repo pour l'instant), affiche le menu d'actions et la prévisualisation
4. **Moteur IA Scribe (backend)** — service existant, reçoit texte + instruction, retourne le texte modifié

### Flux de communication

1. Utilisateur sélectionne du texte dans OnlyOffice
2. Plugin détecte la sélection → affiche bouton "Scribe"
3. Clic sur le bouton → Cozy Drive ouvre l'iframe Scribe
4. Utilisateur choisit une action IA
5. Iframe Scribe envoie texte + instruction au moteur IA
6. Moteur IA retourne le texte modifié
7. Utilisateur prévisualise, peut modifier, puis choisit "Remplacer" ou "Insérer"
8. Iframe Scribe transmet au plugin OnlyOffice
9. Plugin met à jour le document

### Environnement existant

- Cozy Drive local fonctionnel connecté à OnlyOffice Docker
- Codebase existante : React 18, Redux, cozy-client, Rsbuild
- Intégration OnlyOffice existante dans `src/modules/views/OnlyOffice/`
- L'API du moteur IA Scribe n'est pas encore stabilisée dans ses détails

### Risques techniques identifiés

- Le plugin OnlyOffice est le composant le plus incertain — un POC est nécessaire pour valider la faisabilité (dev de plugin, accès à l'API de sélection, manipulation du document, préservation du formatage)
- La version exacte de OnlyOffice n'est pas connue — à vérifier pour la compatibilité de l'API plugin
- La communication cross-iframe (postMessage) entre le plugin et l'iframe Scribe nécessite un protocole bien défini

## Constraints

- **Écosystème** : Doit s'intégrer dans l'écosystème Cozy Cloud existant (cozy-client, cozy-ui, conventions du projet)
- **Architecture** : L'iframe Scribe est hébergée dans Cozy Drive ; le contenu vient du même repo pour l'instant
- **OnlyOffice** : Le plugin doit être compatible avec la version déployée sur l'instance Cozy (à déterminer)
- **API Backend** : Le contrat d'API du moteur IA Scribe n'est pas encore figé — l'interface devra s'adapter

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| POC plugin OnlyOffice en priorité | C'est le composant le plus risqué et le moins connu — lever les incertitudes en premier | — Pending |
| Interface Scribe dans le repo Cozy Drive | Simplifier le développement initial, migration vers app séparée plus tard | — Pending |
| Prévisualisation avant application | L'utilisateur doit garder le contrôle sur ce qui est modifié dans son document | — Pending |
| Communication via postMessage | Seul mécanisme standard pour la communication cross-iframe | — Pending |

---
*Last updated: 2026-02-26 after initialization*
