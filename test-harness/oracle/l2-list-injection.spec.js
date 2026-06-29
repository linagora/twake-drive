/**
 * RÉGRESSION — Injection (md→docx) de listes imbriquées / mixtes (bug Ben 2026-06-29).
 *
 * Bundle : test-harness/corpus/L2/insert/
 * Capturé EN DIRECT via Chrome DevTools MCP sur l'éditeur d'exemple OnlyOffice
 * (plugin Scribe build 2026-06-29.4), sans Cozy ni LLM :
 *   injectAtSelection(empty ¶, inject.md, 'replace') puis, par paragraphe,
 *   GetNumbering().GetLevelIndex() + format via ApiNumbering.ToJSON() → levels.json.
 *
 * Le bug : une réponse LLM avec listes imbriquées indentées à 2 espaces/niveau
 * perdait l'imbrication à l'injection. marked/CommonMark n'imbrique un sous-niveau
 * que si l'indent atteint l'offset de contenu du parent (2 pour "- ", mais 3+ pour
 * "1. ") → les sous-listes NUMÉROTÉES à 2 espaces restaient au niveau 0, et les
 * puces finales aussi. Fix : normalizeListIndent() ré-indente à 4 espaces/niveau
 * (via une pile d'indentation) AVANT marked.lexer.
 *
 * Ce spec verrouille les niveaux d'imbrication CORRIGÉS du document injecté.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const BUNDLE = join(__dirname, '..', 'corpus', 'L2', 'insert')
const levels = JSON.parse(readFileSync(join(BUNDLE, 'levels.json'), 'utf8'))
const byText = t => levels.find(r => r.text === t)

describe('RÉGRESSION L2 — injection listes imbriquées/mixtes (md→docx)', () => {
  it('les sous-items NUMÉROTÉS (2 esp dans le md) sont au niveau 1, ordered', () => {
    expect(byText('Numbered sub-item')).toMatchObject({ ilvl: 1, fmt: 'ordered' })
    expect(byText('Another sub-item')).toMatchObject({ ilvl: 1, fmt: 'ordered' })
  })

  it('le niveau le plus profond (4 esp) est au niveau 2, ordered', () => {
    expect(byText('Even deeper level')).toMatchObject({ ilvl: 2, fmt: 'ordered' })
    expect(byText('Continuation')).toMatchObject({ ilvl: 2, fmt: 'ordered' })
  })

  it('les puces finales gardent leur imbrication (niveau 1, bullet)', () => {
    expect(byText('First bullet')).toMatchObject({ ilvl: 1, fmt: 'bullet' })
    expect(byText('Second bullet')).toMatchObject({ ilvl: 1, fmt: 'bullet' })
  })

  it('les items de tête restent au niveau 0, ordered', () => {
    for (const t of ['First item', 'Three', 'Second item', 'Third item']) {
      expect(byText(t)).toMatchObject({ ilvl: 0, fmt: 'ordered' })
    }
  })

  it("le titre n'est pas une liste (Heading 2)", () => {
    expect(byText('Numbered lists')).toMatchObject({ style: 'Heading 2' })
    expect(byText('Numbered lists').ilvl).toBeUndefined()
  })
})
