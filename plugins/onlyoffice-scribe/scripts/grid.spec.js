import {
  CHART_ROWS,
  findColumnIndex,
  getAnswerOrigins,
  getColumnName,
  isChartInRows,
  isSameCell,
  makeChartRange,
  makeBoxAddress,
  makeSheetContent,
  makeUnionBox,
  parseRange,
  parseRanges,
  placeChart,
  planSheetWrite,
  readAnswerCells,
  readLooseNumber
} from './grid'

const box = (r1, c1, r2, c2) => ({ r1, c1, r2, c2 })
// B2:C5, the cells of a request
const RANGE = box(1, 1, 4, 2)
const ORIGINS = getAnswerOrigins({ range: RANGE, isEmpty: false })

describe('column names', () => {
  it('names the columns as the editor does', () => {
    expect([0, 25, 26, 51, 701, 702].map(getColumnName)).toEqual([
      'A',
      'Z',
      'AA',
      'AZ',
      'ZZ',
      'AAA'
    ])
    expect(['A', 'Z', 'AA', 'ZZ', 'AAA'].map(findColumnIndex)).toEqual([
      0, 25, 26, 701, 702
    ])
  })

  it('finds no column in another text', () => {
    expect(findColumnIndex('a')).toBe(null)
    expect(findColumnIndex('Total')).toBe(null)
    expect(findColumnIndex('')).toBe(null)
  })

  it('writes the address of a box', () => {
    expect(makeBoxAddress(box(0, 0, 4, 3))).toBe('A1:D5')
    expect(makeBoxAddress(box(2, 1, 2, 1))).toBe('B3')
  })
})

describe('makeSheetContent', () => {
  const sheet = {
    sheet: 'Budget',
    range: box(0, 0, 2, 2),
    given: box(0, 0, 2, 2),
    around: null,
    texts: [
      ['Poste', 'T1', 'Total'],
      ['Loyer | charges', '1 200,00 €', '2 400,00 €'],
      ['Courses\nmarché', '800,00 €', '1 750,00 €']
    ],
    formulas: [
      [null, null, null],
      [null, null, '=B2*2'],
      [null, null, '=B3+950']
    ]
  }

  it('gives the cells as a table with their letters and numbers, then the formulas', () => {
    expect(makeSheetContent(sheet)).toBe(
      [
        'Sheet "Budget", cells A1:C3',
        '',
        '|   | A | B | C |',
        '|---|---|---|---|',
        '| 1 | Poste | T1 | Total |',
        '| 2 | Loyer \\| charges | 1 200,00 € | 2 400,00 € |',
        '| 3 | Courses<br>marché | 800,00 € | 1 750,00 € |',
        '',
        'Formulas:',
        'C2: =B2*2',
        'C3: =B3+950'
      ].join('\n')
    )
  })

  it('keeps the column after a cell that ends with a backslash', () => {
    const content = makeSheetContent({
      ...sheet,
      texts: [['C:\\', 'T1', 'Total'], ...sheet.texts.slice(1)]
    })

    expect(content.split('\n')[4]).toBe('| 1 | C:\\\\ | T1 | Total |')
  })

  it('names the selected cell of a block, and the part of a range given', () => {
    const content = makeSheetContent({
      ...sheet,
      range: box(0, 0, 499, 2),
      around: { row: 1, col: 1 }
    })

    expect(content.split('\n')[0]).toBe(
      'Sheet "Budget", cells A1:C500, around B2, only A1:C3 given'
    )
  })

  it('says an empty cell is empty', () => {
    expect(
      makeSheetContent({
        sheet: 'Feuil1',
        range: box(1, 4, 1, 4),
        given: box(1, 4, 1, 4),
        around: { row: 1, col: 4 },
        texts: [['']],
        formulas: [[null]]
      })
    ).toBe('Sheet "Feuil1", cell E2, empty: the cells of an answer start there')
  })
})

describe('readAnswerCells', () => {
  it('reads the cells of a table at the addresses of its letters and numbers', () => {
    const answer = [
      '|   | B | C |',
      '|---|---|---|',
      '| 2 | **1200** | 1350 |',
      '| 6 | =SUM(B2:B5) | =B2*C2*2 |'
    ].join('\n')

    expect(readAnswerCells(answer, ORIGINS)).toEqual([
      { row: 1, col: 1, text: '1200' },
      { row: 1, col: 2, text: '1350' },
      { row: 5, col: 1, text: '=SUM(B2:B5)' },
      { row: 5, col: 2, text: '=B2*C2*2' }
    ])
  })

  it('leaves out the empty cells: the LLM leaves a cell empty to keep it', () => {
    const answer = '| | A | B |\n|---|---|---|\n| 2 | Jean Dupont |  |'

    expect(readAnswerCells(answer, ORIGINS)).toEqual([
      { row: 1, col: 0, text: 'Jean Dupont' }
    ])
  })

  it('reads a table fenced as code, and a formula in backquotes', () => {
    const answer = '```markdown\n| | C |\n|---|---|\n| 6 | `=SUM(C2:C5)` |\n```'

    expect(readAnswerCells(answer, ORIGINS)).toEqual([
      { row: 5, col: 2, text: '=SUM(C2:C5)' }
    ])
  })

  it('reads a table of cells by address, one per row', () => {
    const list =
      '| Address | Value |\n|---|---|\n| A1 | Item |\n| $B$6 | =SUM(B2:B5) |'

    expect(readAnswerCells(list, ORIGINS)).toEqual([
      { row: 0, col: 0, text: 'Item' },
      { row: 5, col: 1, text: '=SUM(B2:B5)' }
    ])
  })

  it('takes labels that look like addresses for labels', () => {
    const quarters = '| Trimestre | Objectif |\n|---|---|\n| T1 | 1000 |'

    expect(readAnswerCells(quarters, ORIGINS)).toEqual([
      { row: 1, col: 1, text: 'Trimestre' },
      { row: 1, col: 2, text: 'Objectif' },
      { row: 2, col: 1, text: 'T1' },
      { row: 2, col: 2, text: '1000' }
    ])
  })

  it('lays a table without letters nor numbers from the top-left cell', () => {
    const answer = '| Q1 | Q2 |\n|---|---|\n| 10 | 20 |'

    expect(readAnswerCells(answer, ORIGINS)).toEqual([
      { row: 1, col: 1, text: 'Q1' },
      { row: 1, col: 2, text: 'Q2' },
      { row: 2, col: 1, text: '10' },
      { row: 2, col: 2, text: '20' }
    ])
  })

  it('lays the rows of a table with letters only from the first row', () => {
    const answer = '| B | C |\n|---|---|\n| x | y |'

    expect(readAnswerCells(answer, ORIGINS)).toEqual([
      { row: 1, col: 1, text: 'x' },
      { row: 1, col: 2, text: 'y' }
    ])
  })

  it('reads a formula given with its address, over the value of the table', () => {
    const answer = [
      '| | A | B |',
      '|---|---|---|',
      '| 6 | Total | 2 240,00 € |',
      '',
      'Formulas:',
      'B6: =SUM(B2:B5)'
    ].join('\n')

    expect(readAnswerCells(answer, ORIGINS)).toEqual([
      { row: 5, col: 0, text: 'Total' },
      { row: 5, col: 1, text: '=SUM(B2:B5)' }
    ])
  })

  it('lays formulas under the range', () => {
    expect(readAnswerCells('=SUM(B2:B5)', ORIGINS)).toEqual([
      { row: 5, col: 1, text: '=SUM(B2:B5)' }
    ])
    expect(readAnswerCells('=SUM(B2:B5)\n=AVERAGE(B2:B5)', ORIGINS)).toEqual([
      { row: 5, col: 1, text: '=SUM(B2:B5)' },
      { row: 6, col: 1, text: '=AVERAGE(B2:B5)' }
    ])
  })

  it('writes a formula at an empty cell', () => {
    const origins = getAnswerOrigins({ range: box(1, 4, 1, 4), isEmpty: true })

    expect(readAnswerCells('=TODAY()', origins)).toEqual([
      { row: 1, col: 4, text: '=TODAY()' }
    ])
  })

  it('gives no cell for an explanation, even in a single line', () => {
    expect(
      readAnswerCells(
        "La région qui a le plus progressé est l'Ouest, avec environ 19,7 %.",
        ORIGINS
      )
    ).toEqual([])
    expect(readAnswerCells('4440', ORIGINS)).toEqual([])
  })

  it('gives no cell for an explanation in paragraphs', () => {
    const answer =
      'La région **Ouest** a le plus progressé.\n\nSes ventes passent de 760 à 910.'

    expect(readAnswerCells(answer, ORIGINS)).toEqual([])
  })
})

describe('readLooseNumber', () => {
  it('reads a number however it is written', () => {
    expect(readLooseNumber('1 200,50 €')).toBe(1200.5)
    expect(readLooseNumber('1 200,50 €')).toBe(1200.5)
    expect(readLooseNumber('1,200.5')).toBe(1200.5)
    expect(readLooseNumber('1200')).toBe(1200)
    expect(readLooseNumber('1 200')).toBe(1200)
    expect(readLooseNumber('-3,5')).toBe(-3.5)
  })

  it('takes a single separator before three digits for the thousands', () => {
    expect(readLooseNumber('1,200')).toBe(1200)
    expect(readLooseNumber('1.200')).toBe(1200)
  })

  it('reads no number in a text', () => {
    expect(readLooseNumber('Nord')).toBe(null)
    expect(readLooseNumber('12 %')).toBe(null)
    expect(readLooseNumber('')).toBe(null)
  })
})

describe('isSameCell', () => {
  it('knows the text a cell shows, its formula and its number', () => {
    const cell = { shown: '2 400,00 €', formula: '=B2+C2' }

    expect(isSameCell('2 400,00 €', cell)).toBe(true)
    expect(isSameCell('=B2 + C2', cell)).toBe(true)
    expect(isSameCell('2400', cell)).toBe(true)
    expect(isSameCell('2500', cell)).toBe(false)
    expect(isSameCell('Loyer', { shown: 'Loyer ', formula: null })).toBe(true)
  })
})

describe('planSheetWrite', () => {
  // A1:C7 of a sheet: a header, four rows, then a row of notes
  const read = (cells, area) => {
    const texts = []
    const formulas = []
    for (let row = area.r1; row <= area.r2; row += 1) {
      texts.push([])
      formulas.push([])
      for (let col = area.c1; col <= area.c2; col += 1) {
        const cell = cells[`${row},${col}`]
        texts.at(-1).push(cell?.shown ?? '')
        formulas.at(-1).push(cell?.formula ?? null)
      }
    }
    return { texts, formulas }
  }
  const SHEET = {
    '0,0': { shown: 'Région' },
    '0,1': { shown: '2024' },
    '0,2': { shown: '2025' },
    '1,0': { shown: 'Nord' },
    '1,1': { shown: '1200' },
    '1,2': { shown: '1350' },
    '2,0': { shown: 'Sud' },
    '2,1': { shown: '980' },
    '2,2': { shown: '1100' },
    '3,1': { shown: '3,0' },
    '3,2': { shown: '0,8', formula: '=C3/C2' }
  }
  // A1:C3, the rows of Nord and Sud
  const range = box(0, 0, 2, 2)
  const plan = (cells, sheet = SHEET) => {
    const area = makeUnionBox(range, cells)
    return planSheetWrite({ cells, range, box: area, ...read(sheet, area) })
  }

  it('writes the cells that change, and leaves the others', () => {
    const result = plan([
      { row: 1, col: 0, text: 'North' },
      { row: 1, col: 1, text: '1 200' },
      { row: 2, col: 2, text: '1100' }
    ])

    expect(result).toEqual({
      insertRows: null,
      insertColumns: null,
      writes: [{ row: 1, col: 0, text: 'North' }],
      skipped: [],
      box: range
    })
  })

  it('writes under the range when the row is empty', () => {
    const empty = { ...SHEET }
    delete empty['3,1']
    delete empty['3,2']
    const result = plan([{ row: 3, col: 1, text: '=SUM(B2:B3)' }], empty)

    expect(result.insertRows).toBe(null)
    expect(result.writes).toEqual([{ row: 3, col: 1, text: '=SUM(B2:B3)' }])
    expect(result.box).toEqual(box(0, 0, 3, 2))
  })

  it('inserts rows under the range when the cells there hold something', () => {
    const result = plan([
      { row: 3, col: 1, text: '=SUM(B2:B3)' },
      { row: 4, col: 1, text: '=AVERAGE(B2:B3)' }
    ])

    expect(result.insertRows).toEqual({ at: 3, count: 2 })
    expect(result.writes).toHaveLength(2)
  })

  it('leaves a cell under the range that the answer gives as it is', () => {
    const result = plan([{ row: 3, col: 2, text: '0,8' }])

    expect(result.insertRows).toBe(null)
    expect(result.writes).toEqual([])
  })

  it('inserts columns beside the range when the cells there hold something', () => {
    const sheet = { ...SHEET, '1,3': { shown: 'note' } }
    const result = plan(
      [
        { row: 0, col: 3, text: 'Progression' },
        { row: 1, col: 3, text: '=C2/B2-1' }
      ],
      sheet
    )

    expect(result.insertColumns).toEqual({ at: 3, count: 1 })
    expect(result.insertRows).toBe(null)
    expect(result.box).toEqual(box(0, 0, 2, 3))
  })

  it('keeps a cell above or left of the range that holds something', () => {
    const lower = box(1, 1, 2, 2)
    const area = box(0, 0, 2, 2)
    const result = planSheetWrite({
      cells: [
        { row: 0, col: 1, text: 'Year 2024' },
        { row: 1, col: 1, text: '1300' }
      ],
      range: lower,
      box: area,
      ...read(SHEET, area)
    })

    expect(result.writes).toEqual([{ row: 1, col: 1, text: '1300' }])
    expect(result.skipped).toEqual([{ row: 0, col: 1 }])
  })
})

describe('charts', () => {
  it('reads a range in A1 notation, with its sheet or not', () => {
    expect(parseRange('A1:C5')).toEqual(box(0, 0, 4, 2))
    expect(parseRange("'Ventes'!$B$2:$C$5")).toEqual(box(1, 1, 4, 2))
    expect(parseRange('C5:A1')).toEqual(box(0, 0, 4, 2))
    expect(parseRange('D3')).toEqual(box(2, 3, 2, 3))
    expect(parseRange('the sales')).toBe(null)
  })

  it('reads a range of several areas', () => {
    expect(parseRanges('A1:A5,C1:C5')).toEqual([
      box(0, 0, 4, 0),
      box(0, 2, 4, 2)
    ])
    expect(parseRanges('A1:A5,sales')).toBe(null)
  })

  it('writes the range of the data as the editor takes it', () => {
    expect(makeChartRange('Ventes', [box(0, 0, 4, 2)])).toBe(
      "'Ventes'!$A$1:$C$5"
    )
    expect(makeChartRange("Paul's", [box(1, 1, 2, 1)])).toBe(
      "'Paul''s'!$B$2:$B$3"
    )
    expect(makeChartRange('Ventes', [box(0, 0, 4, 0), box(0, 2, 4, 2)])).toBe(
      "'Ventes'!$A$1:$A$5,'Ventes'!$C$1:$C$5"
    )
  })

  it('runs the series along the longer side of the data', () => {
    expect(isChartInRows(box(0, 0, 4, 2))).toBe(false)
    expect(isChartInRows(box(0, 0, 1, 6))).toBe(true)
  })

  it('places a chart one column after the last cell used on its rows', () => {
    const lastColumns = [4, 4, 2, 2, 2, ...Array(CHART_ROWS - 5).fill(-1)]

    expect(
      placeChart({ range: box(0, 0, 4, 2), lastColumns, drawings: [] })
    ).toEqual({ row: 0, col: 6 })
  })

  it('places a chart under the charts already beside the data', () => {
    const lastColumns = Array(CHART_ROWS).fill(2)
    const drawings = [box(0, 4, 14, 10), box(40, 4, 50, 10)]

    expect(
      placeChart({ range: box(0, 0, 4, 2), lastColumns, drawings })
    ).toEqual({ row: 16, col: 4 })
  })

  it('leaves a chart elsewhere in the sheet where it is', () => {
    const lastColumns = Array(CHART_ROWS).fill(2)

    expect(
      placeChart({
        range: box(0, 0, 4, 2),
        lastColumns,
        drawings: [box(0, 0, 3, 1), box(40, 4, 50, 10)]
      })
    ).toEqual({ row: 0, col: 4 })
  })
})
