# Requirements: Scribe v3.1 Contrat de réponse structurée LLM (MCP-ready)

**Defined:** 2026-06-16
**Core Value:** L'utilisateur distingue sans ambiguïté ce que le LLM lui *dit* (discussion) de ce qu'il *produit* à insérer dans le document (fragments), et agit fragment par fragment — au clavier comme à la souris.

## v3.1 Requirements

Le contrat `{ discussion: string, fragments?: string[] }` (formalisme JSON Schema, MCP-ready, sans serveur) est **partagé par les deux surfaces**. Différence de cardinalité : le **chat** accepte 0..N fragments ; l'**inline** impose exactement 1 fragment.

### Contrat de réponse

- [ ] **CONTRACT-01**: La réponse du LLM sépare la `discussion` (affichée, jamais insérée) des `fragments` insérables, via un contrat JSON parsé et validé (validation maison, zéro dépendance)
- [ ] **CONTRACT-02**: Dans le chat, une réponse de pure discussion (0 fragment) n'affiche aucune UI d'insertion
- [ ] **CONTRACT-03**: Une réponse non conforme ne bloque jamais l'utilisateur — repli contextuel : chat → message de discussion + action copier/insérer au niveau du message ; inline → le brut devient l'unique fragment insérable
- [ ] **CONTRACT-04**: Les marqueurs de position `{{fragment:N}}` n'altèrent jamais les marqueurs cross-ref existants `{{REF:scribe-ref-N:…}}` (regex stricte + test de préservation)

### Inline (popover)

- [ ] **INLINE-01**: Le popover inline utilise le contrat en imposant **exactement un fragment**, et affiche uniquement ce fragment pour Insérer/Remplacer (la `discussion` n'est pas montrée dans le popover)
- [ ] **INLINE-02**: Chaque échange inline (prompt + discussion + fragment) est répercuté dans l'historique de conversation partagé, et apparaît donc dans le chat à l'ouverture du side panel

### Fragments & cartes (chat)

- [ ] **FRAG-01**: Chaque fragment est rendu dans une carte encadrée, visuellement distincte de la discussion, à l'emplacement de son marqueur `{{fragment:N}}` (fragments non référencés rendus en fin de message)
- [ ] **FRAG-02**: Chaque carte de fragment porte trois boutons : Copier, Insérer, Remplacer
- [ ] **FRAG-03**: Un fragment inséré/remplacé conserve le formatage riche (tables, images, footnotes, cross-refs) via le pipeline de réinjection existant, par fragment
- [ ] **FRAG-04**: Le bouton « Remplacer » n'apparaît que lorsqu'une sélection est active dans le document

### Navigation clavier (chat)

- [ ] **KBD-01**: Depuis l'input du prompt, ↑ déplace le focus vers la carte de fragment la plus récente (la plus proche de l'input), sur le bouton Insérer
- [ ] **KBD-02**: ←/→ font basculer le focus entre les boutons Copier/Insérer/Remplacer de la carte focalisée
- [ ] **KBD-03**: ↑ déplace vers le fragment précédent (même réponse, sinon réponse au-dessus) à travers le fil ; ↓ déplace vers le fragment suivant, puis revient à l'input au-delà du plus récent
- [ ] **KBD-04**: Échap ramène le focus à l'input ; Entrée/Espace active le bouton focalisé

### Conformité & déploiement

- [ ] **PROBE-01**: Une sonde de dev expose la réponse parsée `{discussion, fragments, valid, fellBack, warnings}` et des métriques de conformité (duplication discussion↔fragment, détection de préambule par locale, A/B qualité de prose, table non scindée, REF préservés) — gate de validation avant tout rendu de cartes
- [ ] **FLAG-01**: La fonctionnalité est derrière un feature-flag ; à OFF, le comportement est strictement identique à aujourd'hui (kill-switch)
- [ ] **I18N-01**: Les libellés des cartes et les messages de repli sont traduits (fr, en, de, es, it)

## Future Requirements

Reporté à v3.2+. Suivi mais hors roadmap v3.1.

### Actions groupées

- **BULK-01**: Bouton « Tout insérer / Tout remplacer » pour appliquer tous les fragments séquentiels d'un coup

### Sortie structurée native

- **NATIVE-01**: Mode `response_format: json_object` activé derrière flag, après confirmation par la sonde que le proxy cozy-stack le transmet

### Polish

- **POLISH-01**: Habillage de provenance avancé des cartes (sparkle/accent SCRIBE_PURPLE)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cartes multi-alternatives (pick-one) | La sémantique retenue est « morceaux séquentiels indépendants », pas des alternatives concurrentes |
| Pane d'artefact éditable (style Canvas) | Le document OO EST l'éditeur ; les fragments sont un aperçu en lecture seule |
| Diff / suivi de modifications par fragment | Coûteux et fragile avec PasteHtml/Builder ; la post-sélection est déjà cassée |
| Rendu streaming des cartes | L'endpoint est non streamé |
| Tool/function-calling pour forcer le JSON | Moins portable via le proxy, aucun gain pour un objet à 2 champs |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| _(rempli par le roadmap)_ | | |

**Coverage:**
- v3.1 requirements: 17 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 17

---
*Requirements defined: 2026-06-16*
