# Requirements: Scribe v3.1 Contrat de réponse structurée LLM (MCP-ready)

**Defined:** 2026-06-16
**Core Value:** L'utilisateur distingue sans ambiguïté ce que le LLM lui *dit* (discussion) de ce qu'il *produit* à insérer dans le document (fragments), et agit fragment par fragment — au clavier comme à la souris.

## v3.1 Requirements

Le contrat `{ discussion: string, fragments?: string[] }` (formalisme JSON Schema, MCP-ready, sans serveur) est **partagé par les deux surfaces**. Différence de cardinalité : le **chat** accepte 0..N fragments ; l'**inline** impose exactement 1 fragment.

### Contrat de réponse

- [x] **CONTRACT-01**: La réponse du LLM sépare la `discussion` (affichée, jamais insérée) des `fragments` insérables, via un contrat JSON parsé et validé (validation maison, zéro dépendance)
- [x] **CONTRACT-02**: Dans le chat, une réponse de pure discussion (0 fragment) n'affiche aucune UI d'insertion
- [x] **CONTRACT-03**: Une réponse non conforme ne bloque jamais l'utilisateur — repli contextuel : chat → message de discussion + action copier/insérer au niveau du message ; inline → le brut devient l'unique fragment insérable
- [x] **CONTRACT-04**: Les marqueurs de position `{{fragment:N}}` n'altèrent jamais les marqueurs cross-ref existants `{{REF:scribe-ref-N:…}}` (regex stricte + test de préservation)

### Inline (popover)

- [ ] **INLINE-01**: Le popover inline utilise le contrat en imposant **exactement un fragment**, et affiche uniquement ce fragment pour Insérer/Remplacer (la `discussion` n'est pas montrée dans le popover) — rendu en carte (markdown riche + marqueurs propres) réutilisant FragmentCard/MarkdownPreview de v3.1-04
- [ ] **INLINE-02**: Chaque échange inline (prompt + discussion + fragment) est répercuté dans l'historique de conversation partagé, et apparaît donc dans le chat à l'ouverture du side panel
- [ ] **MENU-01**: Le menu d'actions du popover est refondu — le prompt libre est une entrée intégrée en bas de la liste, suivie d'une entrée « Ouvrir le panneau latéral » qui remplace l'icône open-panel retirée du popover (le bouton flottant sur le document est conservé)

### Fragments & cartes (chat)

- [x] **FRAG-01**: Chaque fragment est rendu dans une carte encadrée, visuellement distincte de la discussion, à l'emplacement de son marqueur `{{fragment:N}}` (fragments non référencés rendus en fin de message)
- [x] **FRAG-02**: Chaque carte de fragment porte trois boutons : Copier, Insérer, Remplacer
- [x] **FRAG-03**: Un fragment inséré/remplacé conserve le formatage riche (tables, images, footnotes, cross-refs) via le pipeline de réinjection existant, par fragment
- [x] **FRAG-04**: Le bouton « Remplacer » n'apparaît que lorsqu'une sélection est active dans le document

### Navigation clavier (chat)

- [x] **KBD-01**: Depuis l'input du prompt, ↑ déplace le focus vers la carte de fragment la plus récente (la plus proche de l'input), sur le bouton Insérer
- [x] **KBD-02**: ←/→ font basculer le focus entre les boutons Copier/Insérer/Remplacer de la carte focalisée
- [x] **KBD-03**: ↑ déplace vers le fragment précédent (même réponse, sinon réponse au-dessus) à travers le fil ; ↓ déplace vers le fragment suivant, puis revient à l'input au-delà du plus récent
- [x] **KBD-04**: Échap ramène le focus à l'input ; Entrée/Espace active le bouton focalisé

### Conformité & i18n

- [x] **PROBE-01**: Une sonde de dev expose la réponse parsée `{discussion, fragments, valid, fellBack, warnings}` et des métriques de conformité (duplication discussion↔fragment, détection de préambule par locale, A/B qualité de prose, table non scindée, REF préservés) — gate de validation avant tout rendu de cartes
- [ ] **I18N-01**: Les libellés des cartes et les messages de repli sont traduits (fr, en, de, es, it)

### Durcissement contrat

- [x] **HARDEN-01**: Sur une réponse au parse invalide, le système re-sollicite le LLM une seule fois avant d'appliquer le repli contextuel
- [ ] **HARDEN-02**: Un corpus de régression de réponses malformées + tests de cas limites passe au vert ; le taux de `fellBack` code-fence est re-mesuré, et le défaut du flag `response_format` (prompt-based vs structured-output) est décidé et documenté

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
| CONTRACT-01 | v3.1-01 | Complete |
| CONTRACT-03 | v3.1-01 | Complete |
| CONTRACT-04 | v3.1-01 | Complete |
| INLINE-01 | v3.1-05 | Pending |
| INLINE-02 | v3.1-05 | Pending |
| MENU-01 | v3.1-05 | Pending |
| PROBE-01 | v3.1-03 | Complete |
| CONTRACT-02 | v3.1-04 | Validated |
| FRAG-01 | v3.1-04 | Validated |
| FRAG-02 | v3.1-04 | Validated |
| FRAG-03 | v3.1-04 | Validated |
| FRAG-04 | v3.1-04 | Validated |
| KBD-01 | v3.1-04 | Validated |
| KBD-02 | v3.1-04 | Validated |
| KBD-03 | v3.1-04 | Validated |
| KBD-04 | v3.1-04 | Validated |
| HARDEN-01 | v3.1-06 | Complete (v3.1-06-01) |
| HARDEN-02 | v3.1-06 | Pending |
| I18N-01 | v3.1-07 | Pending |

**Coverage:**
- v3.1 requirements: 19 total
- Mapped to phases: 19 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-16*
*Roadmap mapped: 2026-06-16 (v3.1-01 to v3.1-05)*
</content>
