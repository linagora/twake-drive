# Roadmap: Scribe pour OnlyOffice

## Overview

Scribe integrates an AI writing assistant into the OnlyOffice editor within Cozy Drive. The delivery follows the technical dependency chain: first set up the plugin development environment and validate that the OnlyOffice plugin API works (the highest-risk unknown), then build the communication bridge between the plugin and Cozy Drive, then build the Scribe user interface with mock AI, and finally wire the complete round-trip so user actions in the Scribe panel modify the document. Each phase delivers a testable capability that unblocks the next.

**Worktree constraint:** All Scribe development happens in a dedicated git worktree so the main Cozy Drive working tree remains available for other features in parallel.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Plugin OnlyOffice POC** - Set up the plugin dev environment (Docker mounting, install process, fast iteration), then validate the OO plugin API: load plugin, detect selection, read text, write text back
- [x] **Phase 2: Contextual Trigger and Communication Bridge** - Wire the Scribe button and postMessage protocol between plugin and Cozy Drive
- [x] **Phase 3: Scribe Interface with Mock AI** - Build the Scribe panel UI with mock text transformation and preview
- [x] **Phase 4: End-to-End Actions** - Complete the round-trip: Replace, Insert, and Cancel actions modify the document from the Scribe panel
- [ ] **Phase 5: Bouton Scribe flottant ancré à la sélection** - Remplacer le bouton Scribe du panneau latéral par un bouton flottant positionné au-dessus de l'éditeur, à proximité de la sélection de texte
- [ ] **Phase 6: Affinement UI/UX** - Aligner l'interface Scribe sur les maquettes de référence (styles, espacements, animations, thème sombre, responsive)

## Phase Details

### Phase 1: Plugin OnlyOffice POC
**Goal**: Establish a working plugin development environment with fast iteration, then confirm that the OnlyOffice plugin API is viable for Scribe by demonstrating a minimal plugin that loads, detects text selection, reads selected text, and can replace or insert text in the document
**Depends on**: Nothing (first phase)
**Requirements**: ENV-01, ENV-02, ENV-03, PLUG-01, PLUG-02, PLUG-03, PLUG-04, PLUG-05
**Success Criteria** (what must be TRUE):
  1. The process for installing a custom plugin into OnlyOffice Document Server (running in Docker) is understood and documented -- the developer can explain step-by-step how a plugin gets loaded
  2. The plugin source code lives on the host filesystem and is mounted into the Docker container so that editing a file on the host is immediately (or near-immediately) available in OnlyOffice without rebuilding the container
  3. A change to the plugin code can be tested in the browser within seconds (via hot-reload, a reload script, or a documented manual reload that takes under 10 seconds)
  4. The OnlyOffice Document Server version is identified and the plugin API compatibility is confirmed
  5. A custom plugin loads successfully in the OnlyOffice editor within the Cozy Drive dev environment
  6. When the user selects text in the document, the plugin detects the selection event and can read the selected text
  7. The plugin can programmatically replace the selected text with different text
  8. The plugin can programmatically insert text after the current selection with a line break
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Dev environment setup, plugin scaffold, Docker volume mount, OO version check
- [x] 01-02-PLAN.md — Plugin API capabilities (selection, read, replace, insert) with test panel

### Phase 2: Contextual Trigger and Communication Bridge
**Goal**: Users can trigger Scribe from a contextual button and the selected text flows from the OnlyOffice plugin to Cozy Drive via a reliable postMessage protocol
**Depends on**: Phase 1
**Requirements**: PLUG-06, COMM-01, COMM-02, COMM-03
**Success Criteria** (what must be TRUE):
  1. A "Scribe" button appears in context when the user has selected text in the document
  2. Clicking the Scribe button causes Cozy Drive to open the Scribe interface (placeholder at this stage)
  3. The selected text is transmitted from the plugin to Cozy Drive via postMessage with origin validation
  4. Cozy Drive can send commands back to the plugin (close, replace, insert) and the plugin receives them
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — cozy-bridge protocol module and plugin-side trigger with intent casting
- [x] 02-02-PLAN.md — Cozy Drive host-side integration (useCozyBridge hook, ScribeModal, round-trip verification)

### Phase 3: Scribe Interface with Mock AI
**Goal**: Users see a functional Scribe panel that displays selected text, applies a mock AI transformation, and shows a preview of the result
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, MOCK-01
**Success Criteria** (what must be TRUE):
  1. A basic HTML/JS interface (not React/cozy-ui) appears as an overlay or panel alongside the OnlyOffice editor
  2. The selected text from the document is displayed in the Scribe interface
  3. The user can trigger a mock transformation that prefixes each line with `$ ` and adds text at the beginning and end
  4. The transformed text is shown as a preview in the interface before any action is taken
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Core Scribe data layer (action definitions, mock transform) and popover container with result panel
- [x] 03-02-PLAN.md — Action menu with submenus, free prompt input, View.jsx integration, human verification

### Phase 4: End-to-End Actions
**Goal**: The complete Scribe loop works: users preview the AI result and choose to replace the original text, insert after it, or cancel -- and the document updates accordingly
**Depends on**: Phase 3
**Requirements**: UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE):
  1. Clicking "Replace" in the Scribe panel substitutes the original selected text in the document with the transformed text
  2. Clicking "Insert" in the Scribe panel adds the transformed text after the original selection with a line break, preserving the original text
  3. Clicking "Cancel" closes the Scribe interface without modifying the document
  4. After any action (Replace, Insert, Cancel), the Scribe interface closes and the user is back in the normal editing state
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Bouton Scribe flottant ancré à la sélection
**Goal**: Remplacer le déclenchement de Scribe depuis le panneau latéral du plugin par un bouton flottant positionné directement au-dessus de l'éditeur, ancré à la sélection de texte — le plugin transmet les coordonnées de la sélection via postMessage et Cozy Drive rend un bouton flottant au-dessus de l'iframe OnlyOffice
**Depends on**: Phase 4
**Requirements**: UI-FLOAT-01, UI-FLOAT-02, COMM-04
**Success Criteria** (what must be TRUE):
  1. Le plugin détecte la position (coordonnées viewport) de la sélection de texte et l'envoie via postMessage en plus du texte sélectionné
  2. Cozy Drive reçoit les coordonnées et affiche un bouton flottant "Scribe" positionné au-dessus de l'iframe OO, à proximité de la sélection (conversion repère iframe → page hôte)
  3. Le bouton flottant apparaît à la sélection et disparaît quand la sélection est perdue
  4. Cliquer sur le bouton flottant ouvre le popover Scribe ancré à cette position (le flux existant menu → résultat → Replace/Insert est préservé)
  5. Le panneau latéral du plugin n'est plus nécessaire pour déclencher Scribe
**Plans:** 2 plans

Plans:
- [ ] 05-01-PLAN.md — Selection coordinate emission (plugin mouse tracking + SELECTION_POSITION protocol), CozyBridge handler, useCozyBridge extension, ScribeFloatingButton component with portal rendering and coordinate conversion
- [ ] 05-02-PLAN.md — Wire floating button to ScribePopover with dynamic anchorPosition, triggerIntent for synthetic intent flow, remove side panel, human verification

### Phase 6: Affinement UI/UX
**Goal**: Aligner l'interface Scribe (bouton flottant, popover, menu d'actions, panneau de résultat) sur les maquettes de référence — styles, espacements, icônes, animations, gestion du thème sombre OO, et polish général
**Depends on**: Phase 5
**Requirements**: UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. L'apparence visuelle de Scribe correspond aux maquettes fournies (couleurs, typographie, espacements, icônes)
  2. Les interactions sont fluides (transitions menu → résultat, apparition/disparition du bouton flottant, hover sur sous-menus)
  3. Scribe fonctionne correctement avec le thème sombre d'OnlyOffice (pas de texte blanc sur fond blanc, contrastes corrects)
  4. Le popover et le bouton flottant se repositionnent correctement si la fenêtre est redimensionnée ou si l'éditeur scrolle
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plugin OnlyOffice POC | 2/2 | Complete | 2026-02-28 |
| 2. Contextual Trigger and Communication Bridge | 2/2 | Complete | 2026-02-28 |
| 3. Scribe Interface with Mock AI | 2/2 | Complete | 2026-03-01 |
| 4. End-to-End Actions | 0/0 | Complete (covered by Phase 2-3) | 2026-03-01 |
| 5. Bouton Scribe flottant ancré à la sélection | 0/2 | In progress | - |
| 6. Affinement UI/UX | 0/0 | Not started | - |
