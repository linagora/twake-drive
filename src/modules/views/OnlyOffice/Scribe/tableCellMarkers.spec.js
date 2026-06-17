/**
 * Couche unitaire (T-01) — fonctions pures de tableCellMarkers.js.
 *
 * Ces tests ne dépendent PAS d'OnlyOffice : ils couvrent le parsing/validation
 * des marqueurs [CELL:r,c] et le rendu d'aperçu GFM. Ils sont tracés aux cas de
 * `.planning/SELECTION-CASES.md` quand c'est pertinent (T8, T11, T12a).
 */
import {
  parseCellMarkers,
  parseTableBlocks,
  validateCellCount,
  validateTableCounts,
  cellsToMarkdownTable,
  transformCellMarkersForPreview
} from './tableCellMarkers'

describe('tableCellMarkers', () => {
  describe('parseCellMarkers', () => {
    it('parse plusieurs cellules avec leurs coordonnées', () => {
      expect(parseCellMarkers('[CELL:0,0]A[/CELL][CELL:0,1]B[/CELL]')).toEqual([
        { row: 0, col: 0, text: 'A' },
        { row: 0, col: 1, text: 'B' }
      ])
    })

    it('renvoie [] quand aucun marqueur', () => {
      expect(parseCellMarkers('pas de marqueur ici')).toEqual([])
    })

    it('préserve le contenu multi-paragraphe (\\n\\n) — cas T8', () => {
      const cells = parseCellMarkers('[CELL:1,2]ligne1\n\nligne2[/CELL]')
      expect(cells).toEqual([{ row: 1, col: 2, text: 'ligne1\n\nligne2' }])
    })
  })

  describe('parseTableBlocks', () => {
    it('parse plusieurs blocs [TABLE:N] avec leurs cellules', () => {
      const r = parseTableBlocks(
        '[TABLE:0][CELL:0,0]a[/CELL][/TABLE][TABLE:1][CELL:0,0]b[/CELL][/TABLE]'
      )
      expect(r).toHaveLength(2)
      expect(r[0].index).toBe(0)
      expect(r[1].index).toBe(1)
      expect(r[1].cells[0].text).toBe('b')
    })
  })

  describe('validateCellCount (global)', () => {
    it('valide quand le nombre de cellules est ≥ attendu (surplus accepté)', () => {
      const v = validateCellCount(
        '[CELL:0,0]a[/CELL]',
        '[CELL:0,0]a[/CELL][CELL:0,1]b[/CELL]'
      )
      expect(v).toEqual({ valid: true, expected: 1, actual: 2 })
    })

    it('valide trivialement quand l’extraction ne contenait aucune cellule', () => {
      expect(validateCellCount('texte sans table', 'réponse')).toEqual({
        valid: true,
        expected: 0,
        actual: 0
      })
    })
  })

  describe('validateTableCounts (par table)', () => {
    it('valide quand les comptes correspondent', () => {
      const v = validateTableCounts(
        '[TABLE:0][CELL:0,0]x[/CELL][/TABLE]',
        '[TABLE:0][CELL:0,0]y[/CELL][/TABLE]'
      )
      expect(v.valid).toBe(true)
      expect(v.warning).toBeNull()
    })

    it('signale un mismatch de cellules — cas T11', () => {
      const v = validateTableCounts(
        '[TABLE:0][CELL:0,0]a[/CELL][CELL:0,1]b[/CELL][/TABLE]',
        '[TABLE:0][CELL:0,0]a[/CELL][/TABLE]'
      )
      expect(v.valid).toBe(false)
      expect(v.warning).toContain('expected 2 cells, got 1')
      expect(v.details).toEqual([{ tableIndex: 0, expected: 2, actual: 1 }])
    })
  })

  describe('cellsToMarkdownTable', () => {
    it('construit un pipe-table GFM avec ligne d’en-tête (row 0)', () => {
      const out = cellsToMarkdownTable([
        { row: 0, col: 0, text: 'h1' },
        { row: 0, col: 1, text: 'h2' },
        { row: 1, col: 0, text: 'a' },
        { row: 1, col: 1, text: 'b' }
      ])
      expect(out).toBe('| h1 | h2 |\n| --- | --- |\n| a | b |')
    })

    it('fusion horizontale → désalignement cosmétique (cellule vide en bout) — cas T12a', () => {
      // r0 a 3 cellules logiques ; r1 n’en a que 2 (fusion H) → la grille
      // maxCol=2 laisse la dernière colonne vide sur r1. Comportement CONNU
      // et accepté (cf SELECTION-CASES.md §4bis, décision « aperçu désaligné = v1 »).
      const out = cellsToMarkdownTable([
        { row: 0, col: 0, text: 'A0' },
        { row: 0, col: 1, text: 'B0' },
        { row: 0, col: 2, text: 'C0' },
        { row: 1, col: 0, text: 'A3' },
        { row: 1, col: 1, text: 'B3' }
      ])
      expect(out).toContain('| A3 | B3 |  |')
    })

    it('renvoie une chaîne vide si aucune cellule', () => {
      expect(cellsToMarkdownTable([])).toBe('')
    })
  })

  describe('transformCellMarkersForPreview', () => {
    it('remplace un bloc [TABLE:N] par son pipe-table', () => {
      const { displayMd, warning } = transformCellMarkersForPreview(
        'avant [TABLE:0][CELL:0,0]a[/CELL][CELL:0,1]b[/CELL][/TABLE] après',
        '[TABLE:0][CELL:0,0]a[/CELL][CELL:0,1]b[/CELL][/TABLE]'
      )
      expect(displayMd).toContain('| a | b |')
      expect(warning).toBeNull()
    })

    it('laisse le texte intact quand aucun marqueur', () => {
      expect(transformCellMarkersForPreview('juste du texte', '')).toEqual({
        displayMd: 'juste du texte',
        warning: null
      })
    })
  })
})
