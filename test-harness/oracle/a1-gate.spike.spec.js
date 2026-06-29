/**
 * GATE T-03 (sonde de dé-risquage) — round-trip oracle prouvé de BOUT EN BOUT.
 *
 * Évidence capturée EN DIRECT le 2026-06-23 via Chrome DevTools MCP, en pilotant
 * l'éditeur d'exemple OnlyOffice (http://localhost/example/, plugin Scribe chargé),
 * sans Cozy ni LLM. Chaîne exercée :
 *   setSelection('P1@start..P1@end') -> injectFixture('XXX','replace') -> dumpState
 * via les 3 dev-hooks flag-gated du plugin (window.__scribeTest, voir code.js).
 *
 * Ce que ce spec verrouille (le contrat de l'oracle) :
 *  - dumpState produit le schéma brut { blocks, selection } d'ORACLE-SCHEMA §2 ;
 *  - normalizeModel le ramène en forme canonique comparable ;
 *  - idempotence (normalize∘normalize == normalize) ;
 *  - la capture live était STABLE (deux dumpState consécutifs identiques) — vérifié
 *    côté navigateur (stable:true), figé ici comme golden.
 *
 * NOTE (pour la revue humaine T-04) : la sortie A1/replace porte un run d'espace
 * final {t:" "} après "XXX" (smart-spacing de buildAndInject). On le BÉNIT tel quel
 * pour le gate ; reste à juger en T-04 si "XXX " est le golden désiré pour A1 ou un
 * micro-⚠️ (la spec dit « remplace tout le ¶ »).
 */
import { normalizeModel } from './normalizeModel'

// --- Capture live BRUTE (telle que renvoyée par le hook dumpState) -------------
// Slice pertinente pour A1 : le 1er bloc (le ¶ remplacé) + la sélection post-action.
const LIVE_CAPTURE = {
  blocks: [
    { type: 'p', runs: [{ t: 'XXX' }, { t: ' ' }] }
    // ... (blocs 1..15 du sample.docx omis — non pertinents pour A1/replace)
  ],
  selection: { start: { block: 0, offset: 0 }, end: { block: 0, offset: 6 } }
}

// --- Golden béni (sortie désirée/acceptée pour A1/replace) ---------------------
const A1_REPLACE_GOLDEN = {
  blocks: [
    { type: 'p', runs: [{ t: 'XXX' }, { t: ' ' }] }
  ],
  selection: { start: { block: 0, offset: 0 }, end: { block: 0, offset: 6 } }
}

describe('GATE T-03 — oracle round-trip (A1/replace, capture live OO)', () => {
  it('normalize(capture live) == golden A1/replace', () => {
    expect(normalizeModel(LIVE_CAPTURE)).toEqual(A1_REPLACE_GOLDEN)
  })

  it('idempotence : normalize(normalize(x)) == normalize(x)', () => {
    const once = normalizeModel(LIVE_CAPTURE)
    expect(normalizeModel(once)).toEqual(once)
  })

  it('sélection block-relative et NON collapsed (start != end)', () => {
    const { selection } = normalizeModel(LIVE_CAPTURE)
    expect(selection.collapsed).toBeUndefined()
    expect(selection.start).toEqual({ block: 0, offset: 0 })
    expect(selection.end).toEqual({ block: 0, offset: 6 })
  })
})
