import {
  CHART_TYPES,
  makeAnswerActions,
  makeCapabilities,
  makeInstructions,
  makeSuggestions,
  normalizeChart,
  normalizeSlide
} from '@/modules/views/OnlyOffice/Scribe/capabilities'

const t = key => `t(${key})`

describe('makeCapabilities', () => {
  it('lets the assistant propose a slide for a presentation, with a translated label', () => {
    const [capability, ...others] = makeCapabilities({
      documentType: 'slide',
      t
    })

    expect(others).toEqual([])
    expect(capability).toMatchObject({
      name: 'insert_slide',
      label: 't(OnlyOffice.scribe.insertSlide)',
      examples: [
        {
          message: 'Ajoute une diapositive sur le budget',
          needs_documents: false
        },
        { message: 'Add a closing slide', needs_documents: false }
      ],
      parameters: { required: ['title', 'bullets'] },
      confirm: true
    })
  })

  it('gives a text document no capability', () => {
    expect(makeCapabilities({ documentType: 'word', t })).toEqual([])
  })

  it('lets the assistant propose a chart for a spreadsheet, of any type', () => {
    const [chart] = makeCapabilities({ documentType: 'cell', t })

    expect(chart).toEqual({
      name: 'insert_chart',
      label: 't(OnlyOffice.scribe.insertChart)',
      description: expect.stringContaining('insert a chart'),
      examples: expect.any(Array),
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: expect.any(String),
            title: 't(OnlyOffice.scribe.chartType)'
          },
          range: {
            type: 'string',
            description: expect.any(String),
            title: 't(OnlyOffice.scribe.chartRange)'
          },
          title: { type: 'string', description: expect.any(String) }
        },
        required: ['type', 'range']
      },
      instructions: expect.any(String),
      confirm: true
    })
    CHART_TYPES.forEach(type =>
      expect(normalizeChart({ type })?.chartType).toBe(type)
    )
  })

  // The stack refuses every message of the conversation for an action past
  // its limits (model/rag/router.go of cozy-stack), and the assistant does
  // not check them
  it('keeps the capabilities within the limits of the stack', () => {
    ;['slide', 'word', 'cell'].forEach(documentType => {
      const suggestions = makeSuggestions({ documentType, t })
      makeCapabilities({ documentType, t }).forEach(capability => {
        const chips = suggestions.filter(
          ({ capability: name }) => name === capability.name
        )
        expect(capability.description.length).toBeLessThanOrEqual(1000)
        expect(capability.instructions.length).toBeLessThanOrEqual(1000)
        expect(capability.examples.length + chips.length).toBeLessThanOrEqual(5)
        capability.examples.forEach(({ message }) =>
          expect(message.length).toBeLessThanOrEqual(300)
        )
        Object.values(capability.parameters.properties).forEach(
          ({ description }) =>
            expect(description.length).toBeLessThanOrEqual(300)
        )
      })
    })
  })

  it('gives the other editors no capability', () => {
    expect(makeCapabilities({ documentType: 'pdf', t })).toEqual([])
    expect(makeCapabilities({ documentType: undefined, t })).toEqual([])
  })

  it('names the capabilities as the assistant wants them', () => {
    ;['slide', 'word', 'cell'].forEach(documentType => {
      makeCapabilities({ documentType, t }).forEach(({ name }) => {
        expect(name).toMatch(/^[a-z][a-z0-9_]{0,39}$/)
        expect(name).not.toBe('search')
      })
    })
  })
})

describe('makeSuggestions', () => {
  it('offers the menu of the assistant, then a new slide, in a presentation', () => {
    expect(makeSuggestions({ documentType: 'slide', t })).toEqual([
      { name: 'catalogue' },
      {
        name: 'new_slide',
        capability: 'insert_slide',
        label: 't(OnlyOffice.scribe.suggestions.newSlide)',
        message: 't(OnlyOffice.scribe.suggestions.newSlideMessage)'
      }
    ])
  })

  it('offers the menu of the assistant, then a table, in a text document', () => {
    expect(makeSuggestions({ documentType: 'word', t })).toEqual([
      { name: 'catalogue' },
      {
        name: 'table',
        label: 't(OnlyOffice.scribe.suggestions.table)',
        message: 't(OnlyOffice.scribe.suggestions.tableMessage)'
      }
    ])
  })

  it('offers the chips of a spreadsheet only', () => {
    const suggestions = makeSuggestions({ documentType: 'cell', t })

    expect(suggestions.map(({ name }) => name)).toEqual([
      'explain',
      'clean_up',
      'totals',
      'chart'
    ])
    expect(suggestions[3]).toEqual({
      name: 'chart',
      capability: 'insert_chart',
      label: 't(OnlyOffice.scribe.suggestions.chart)',
      message: 't(OnlyOffice.scribe.suggestions.chartMessage)'
    })
    expect(suggestions[2]).toEqual({
      name: 'totals',
      label: 't(OnlyOffice.scribe.suggestions.totals)',
      message: 't(OnlyOffice.scribe.suggestions.totalsMessage)'
    })
  })

  it('gives the other editors no chip', () => {
    expect(makeSuggestions({ documentType: 'pdf', t })).toEqual([])
    expect(makeSuggestions({ documentType: undefined, t })).toEqual([])
  })
})

describe('normalizeChart', () => {
  it('gives the type as the editor names it, the range and the title', () => {
    expect(
      normalizeChart({
        type: 'Horizontal Bar',
        range: ' a1:c4 ',
        title: ' Ventes '
      })
    ).toEqual({ chartType: 'horizontalBar', range: 'A1:C4', title: 'Ventes' })
    expect(
      normalizeChart({ type: 'line', range: "'Ventes'!$A$1:$C$5" })
    ).toEqual({
      chartType: 'lineNormal',
      range: "'VENTES'!$A$1:$C$5",
      title: ''
    })
  })

  it('takes a range of several areas, as the names and one column of values', () => {
    expect(normalizeChart({ type: 'pie', range: 'A1:A5, c1:c5' }).range).toBe(
      'A1:A5,C1:C5'
    )
    expect(normalizeChart({ type: 'pie', range: 'A1:A5;C1:C5' }).range).toBe(
      'A1:A5,C1:C5'
    )
    expect(normalizeChart({ type: 'pie', range: 'A1:A5,sales' }).range).toBe(
      null
    )
  })

  it('leaves the range to the cells given when it is no range', () => {
    expect(normalizeChart({ type: 'pie', range: 'the sales' })).toEqual({
      chartType: 'pie',
      range: null,
      title: ''
    })
  })

  it('takes the type before chart or graph', () => {
    expect(normalizeChart({ type: 'Pie chart' }).chartType).toBe('pie')
    expect(normalizeChart({ type: 'line graph' }).chartType).toBe('lineNormal')
  })

  it('gives null for a type the editor does not make', () => {
    expect(normalizeChart({ type: 'treemap', range: 'A1:B3' })).toBe(null)
    expect(normalizeChart({ type: 'constructor' })).toBe(null)
    expect(normalizeChart({ range: 'A1:B3' })).toBe(null)
    expect(normalizeChart(null)).toBe(null)
  })
})

describe('makeInstructions', () => {
  it('tells the LLM how to answer with the cells of a spreadsheet', () => {
    const instructions = makeInstructions({ documentType: 'cell' })

    expect(instructions).toContain('column letter')
    expect(instructions).toContain('formula in English')
  })

  it('leaves the other editors the instructions of the assistant', () => {
    expect(makeInstructions({ documentType: 'word' })).toBe(null)
    expect(makeInstructions({ documentType: 'slide' })).toBe(null)
  })
})

describe('makeAnswerActions', () => {
  it('inserts an answer, or replaces a selection that can be', () => {
    expect(
      makeAnswerActions({ documentType: 'word', target: 'selection' })
    ).toEqual(['insert', 'replace'])
    expect(
      makeAnswerActions({
        documentType: 'word',
        target: 'selection',
        canReplace: false
      })
    ).toEqual(['insert'])
    expect(
      makeAnswerActions({ documentType: 'slide', target: 'slide' })
    ).toEqual(['insert'])
  })

  it('applies the cells of an answer in a spreadsheet', () => {
    expect(
      makeAnswerActions({ documentType: 'cell', target: 'region' })
    ).toEqual(['apply'])
  })
})

describe('normalizeSlide', () => {
  it('gives the title and the bullets of the slide', () => {
    expect(
      normalizeSlide({ title: 'Budget', bullets: ['Dépenses', 'Recettes'] })
    ).toEqual({ title: 'Budget', bullets: ['Dépenses', 'Recettes'] })
  })

  it('leaves out the marks and the empty lines of the bullets', () => {
    expect(
      normalizeSlide({
        title: ' Budget ',
        bullets: ['- Dépenses', '* Recettes', '• Marge', '  ', '-1 % de frais']
      })
    ).toEqual({
      title: 'Budget',
      bullets: ['Dépenses', 'Recettes', 'Marge', '-1 % de frais']
    })
  })

  it('takes a slide with a title only, or bullets only', () => {
    expect(normalizeSlide({ title: 'Merci', bullets: [] })).toEqual({
      title: 'Merci',
      bullets: []
    })
    expect(normalizeSlide({ title: '', bullets: ['Une idée'] })).toEqual({
      title: '',
      bullets: ['Une idée']
    })
  })

  it('gives null for wrong parameters or an empty slide', () => {
    expect(normalizeSlide(null)).toBe(null)
    expect(normalizeSlide({ title: 'Budget' })).toBe(null)
    expect(normalizeSlide({ title: 3, bullets: [] })).toBe(null)
    expect(normalizeSlide({ title: 'Budget', bullets: 'Dépenses' })).toBe(null)
    expect(normalizeSlide({ title: 'Budget', bullets: [1, 2] })).toBe(null)
    expect(normalizeSlide({ title: ' ', bullets: [''] })).toBe(null)
  })
})
