/**
 * Tests unitaires de l'oracle (T-03, sans OO). Fixtures ancrées sur la sortie
 * RÉELLE de la sonde (`probe-merged-cells.js`) : artefacts `\t`/`\r\n`,
 * continuation de fusion V = cellule vide distincte.
 */
import { normalizeModel, normText } from './normalizeModel'

describe('oracle/normalizeModel', () => {
  describe('normText', () => {
    it('retire \\t (séparateur de cellule) et \\r\\n (marque de ¶) — artefacts OO', () => {
      expect(normText('A0\t')).toBe('A0')
      expect(normText('C0\r\n')).toBe('C0')
    })
    it('convertit le nbsp (U+00A0) en espace', () => {
      expect(normText('a\u00a0b')).toBe('a b')
    })
  })

  describe('paragraphes', () => {
    it('ne garde que les flags de run vrais (drop falsy) + le lien', () => {
      const r = normalizeModel({
        blocks: [{ type: 'p', runs: [{ t: 'x', b: 1, i: false, u: 0, code: 1, link: '' }] }]
      })
      expect(r.blocks[0].runs[0]).toEqual({ t: 'x', b: 1, code: 1 })
    })
    it('strip les champs volatils par whitelist (pos, rsid…)', () => {
      const r = normalizeModel({
        blocks: [{ type: 'p', pos: 123, runs: [{ t: 'x', rsid: 'abc' }] }]
      })
      expect(r.blocks[0]).toEqual({ type: 'p', runs: [{ t: 'x' }] })
    })
    it('drop les runs purement vides (bruit), garde la structure du ¶', () => {
      const r = normalizeModel({ blocks: [{ type: 'p', runs: [{ t: '\t' }, { t: 'ok' }] }] })
      expect(r.blocks[0].runs).toEqual([{ t: 'ok' }])
    })
  })

  describe('tables (ancré sonde)', () => {
    it('fusion V : maître porte le texte, continuation = cellule vide distincte, vmerge conservé', () => {
      const captured = {
        blocks: [
          {
            type: 'table',
            grid: [
              [{ rowIndex: 1, cellIndex: 0, blocks: [{ type: 'p', runs: [{ t: 'A1\t' }] }], vmerge: 'master' }],
              [{ rowIndex: 2, cellIndex: 0, blocks: [{ type: 'p', runs: [{ t: '\t' }] }], vmerge: 'cont' }]
            ]
          }
        ]
      }
      const r = normalizeModel(captured)
      expect(r.blocks[0].grid[0][0]).toEqual({
        blocks: [{ type: 'p', runs: [{ t: 'A1' }] }],
        vmerge: 'master'
      })
      expect(r.blocks[0].grid[1][0]).toEqual({
        blocks: [{ type: 'p', runs: [] }],
        vmerge: 'cont'
      })
    })
    it('conserve hspan>1 (fusion H), ignore hspan=1', () => {
      const r = normalizeModel({
        blocks: [
          {
            type: 'table',
            grid: [
              [
                { blocks: [{ type: 'p', runs: [{ t: 'A3' }] }], hspan: 1 },
                { blocks: [{ type: 'p', runs: [{ t: 'B3' }] }], hspan: 2 }
              ]
            ]
          }
        ]
      })
      expect(r.blocks[0].grid[0][0].hspan).toBeUndefined()
      expect(r.blocks[0].grid[0][1].hspan).toBe(2)
    })
  })

  describe('sélection', () => {
    it('marque collapsed quand start==end (curseur, cas A0)', () => {
      const r = normalizeModel({
        blocks: [],
        selection: { start: { block: 0, offset: 3 }, end: { block: 0, offset: 3 } }
      })
      expect(r.selection).toEqual({
        start: { block: 0, offset: 3 },
        end: { block: 0, offset: 3 },
        collapsed: true
      })
    })
    it('pas de collapsed quand start!=end', () => {
      const r = normalizeModel({
        blocks: [],
        selection: { start: { block: 0, offset: 3 }, end: { block: 0, offset: 7 } }
      })
      expect(r.selection.collapsed).toBeUndefined()
    })
    it('selection absente → null', () => {
      expect(normalizeModel({ blocks: [] }).selection).toBeNull()
    })
  })

  it('idempotence : normalize(normalize(x)) === normalize(x)', () => {
    const captured = {
      blocks: [
        { type: 'p', pos: 9, runs: [{ t: 'Hello world\t', b: 1, rsid: 'z' }] },
        { type: 'table', grid: [[{ rowIndex: 0, cellIndex: 0, blocks: [{ type: 'p', runs: [{ t: 'c\r\n' }] }] }]] }
      ],
      selection: { start: { block: 0, offset: 0 }, end: { block: 0, offset: 0 } }
    }
    const once = normalizeModel(captured)
    expect(normalizeModel(once)).toEqual(once)
  })
})
