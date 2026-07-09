/**
 * RÉGRESSION — Extraction MD des listes numérotées / imbriquées / mixtes
 * (bug Ben 2026-06-29).
 *
 * Bundle : test-harness/corpus/L1/extract/
 * Capturé EN DIRECT via Chrome DevTools MCP sur l'éditeur d'exemple OnlyOffice
 * (plugin Scribe build 2026-06-29.3), sans Cozy ni LLM :
 *   setSelection('P1@start..P6@end') -> extractSelection  (extract.json)
 * sur fixture `nested-lists.docx` = liste imbriquée MIXTE.
 *
 * Le bug : `isListParagraph` lisait `numPr.GetNumFmt()` — méthode INEXISTANTE
 * dans le SDK → format toujours null → TOUTE liste classée "bullet". Les listes
 * numérotées ressortaient donc en puces dans le MD. Fix : lire le vrai format via
 * `ApiNumbering.ToJSON()` (numFmt.val par niveau) + niveau réel via GetLevelIndex().
 *
 * Ce spec verrouille la sortie CORRIGÉE : numéros en `N.`, puces en `- `,
 * imbrication indentée (2 esp/niveau), mélange puces/numéros conservé.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const BUNDLE = join(__dirname, '..', 'corpus', 'L1', 'extract')
const golden = JSON.parse(readFileSync(join(BUNDLE, 'extract.json'), 'utf8'))
const lines = golden.md.split('\n')

describe('RÉGRESSION L1 — extraction MD listes numérotées/imbriquées/mixtes', () => {
  it('les items numérotés (niveau 0) sortent en "N." et NON en puce', () => {
    expect(lines[0]).toBe('1. Numbered one')
    expect(lines[1]).toBe('2. Numbered two')
    expect(lines[5]).toBe('3. Numbered three')
    // garde anti-régression directe : aucune ligne numérotée ne commence par "- "
    expect(lines[0].startsWith('- ')).toBe(false)
  })

  it('le compteur numéroté de niveau 0 REPREND après l’imbrication (1,2,…,3)', () => {
    const top = lines.filter(l => /^\d+\. /.test(l))
    expect(top).toEqual(['1. Numbered one', '2. Numbered two', '3. Numbered three'])
  })

  it('puce imbriquée niveau 1 = 2 espaces + "- "', () => {
    expect(lines[2]).toBe('  - Bullet under two')
  })

  it('sous-liste NUMÉROTÉE niveau 1 = 2 espaces + "1." (pas une puce)', () => {
    expect(lines[3]).toBe('  1. Numbered sub')
  })

  it('puce profonde niveau 2 = 4 espaces + "- "', () => {
    expect(lines[4]).toBe('    - Deep bullet')
  })

  it('mélange puces + numéros présent (les deux marqueurs coexistent)', () => {
    expect(golden.md).toMatch(/^\d+\. /m)   // au moins un numéroté
    expect(golden.md).toMatch(/^ *- /m)     // au moins une puce
  })
})
