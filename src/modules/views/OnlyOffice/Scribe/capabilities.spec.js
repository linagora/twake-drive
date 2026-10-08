import {
  makeCapabilities,
  makeSuggestions,
  makeTableMarkdown,
  normalizeSlide,
  normalizeTable
} from '@/modules/views/OnlyOffice/Scribe/capabilities'

const t = key => `t(${key})`

describe('makeCapabilities', () => {
  it('lets the assistant add a slide to a presentation at once, with a translated label', () => {
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
      confirm: false
    })
  })

  it('lets the assistant add a table to a text document at once', () => {
    const [capability, ...others] = makeCapabilities({
      documentType: 'word',
      t
    })

    expect(others).toEqual([])
    expect(capability).toEqual({
      name: 'insert_table',
      description: expect.stringContaining('insert a new table'),
      examples: [
        {
          message: 'Fais un tableau des lots et de leur budget',
          needs_documents: false
        },
        { message: 'Present these figures as a table', needs_documents: false }
      ],
      parameters: {
        type: 'object',
        properties: {
          caption: expect.objectContaining({ type: 'string' }),
          columns: expect.objectContaining({
            type: 'array',
            items: { type: 'string' }
          }),
          rows: expect.objectContaining({
            type: 'array',
            items: { type: 'string' }
          })
        },
        required: ['columns', 'rows']
      },
      instructions: expect.any(String),
      confirm: false
    })
  })

  it('gives the other editors no capability', () => {
    expect(makeCapabilities({ documentType: 'cell', t })).toEqual([])
    expect(makeCapabilities({ documentType: undefined, t })).toEqual([])
  })

  it('names the capabilities as the assistant wants them', () => {
    ;['slide', 'word'].forEach(documentType => {
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
        capability: 'insert_table',
        label: 't(OnlyOffice.scribe.suggestions.table)',
        message: 't(OnlyOffice.scribe.suggestions.tableMessage)'
      }
    ])
  })

  it('gives the other editors no chip', () => {
    expect(makeSuggestions({ documentType: 'cell', t })).toEqual([])
    expect(makeSuggestions({ documentType: undefined, t })).toEqual([])
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

describe('normalizeTable', () => {
  it('lays the cells of each row on the columns', () => {
    expect(
      normalizeTable({
        caption: ' Budget des lots ',
        columns: ['Lot ', ' Budget'],
        rows: ['Atlas | 42 000 €', ' Borée|12 000 € ']
      })
    ).toEqual({
      caption: 'Budget des lots',
      columns: ['Lot', 'Budget'],
      rows: [
        ['Atlas', '42 000 €'],
        ['Borée', '12 000 €']
      ]
    })
  })

  it('pads the rows to the count of columns, and drops the empty ones', () => {
    expect(
      normalizeTable({
        columns: ['Lot', 'Budget', 'Statut'],
        rows: ['Atlas', 'Borée | 12 | En cours', ' | ', '']
      })
    ).toEqual({
      caption: '',
      columns: ['Lot', 'Budget', 'Statut'],
      rows: [
        ['Atlas', '', ''],
        ['Borée', '12', 'En cours']
      ]
    })
  })

  it('widens the table to a row longer than the header, keeping its cells', () => {
    expect(
      normalizeTable({
        columns: ['Lot', 'Responsable', 'Coût'],
        rows: ['1 | Conception | Alice | 120 000', '2 | Développement | Bruno']
      })
    ).toEqual({
      caption: '',
      columns: ['Lot', 'Responsable', 'Coût', ''],
      rows: [
        ['1', 'Conception', 'Alice', '120 000'],
        ['2', 'Développement', 'Bruno', '']
      ]
    })
  })

  it('reads the rows the LLM wrote as the lines of a Markdown table', () => {
    expect(
      normalizeTable({
        caption: '',
        columns: ['Lot', 'Budget'],
        rows: ['| --- | --- |', '| Atlas | 42 |', '|Borée|12|']
      })
    ).toEqual({
      caption: '',
      columns: ['Lot', 'Budget'],
      rows: [
        ['Atlas', '42'],
        ['Borée', '12']
      ]
    })
  })

  it('gives null for wrong parameters, or a table without columns or rows', () => {
    expect(normalizeTable(null)).toBe(null)
    expect(normalizeTable({ columns: ['Lot'] })).toBe(null)
    expect(normalizeTable({ columns: 'Lot', rows: ['Atlas'] })).toBe(null)
    expect(normalizeTable({ columns: ['Lot'], rows: [['Atlas']] })).toBe(null)
    expect(
      normalizeTable({ caption: 1, columns: ['Lot'], rows: ['Atlas'] })
    ).toBe(null)
    expect(normalizeTable({ columns: [], rows: ['Atlas'] })).toBe(null)
    expect(normalizeTable({ columns: ['Lot'], rows: [] })).toBe(null)
    expect(normalizeTable({ columns: ['Lot'], rows: [' ', '|'] })).toBe(null)
  })
})

describe('makeTableMarkdown', () => {
  it('writes the table with its caption above', () => {
    expect(
      makeTableMarkdown({
        caption: 'Budget des lots',
        columns: ['Lot', 'Budget'],
        rows: [
          ['Atlas', '42 000 €'],
          ['Borée', '']
        ]
      })
    ).toBe(
      'Budget des lots\n\n| Lot | Budget |\n| --- | --- |\n| Atlas | 42 000 € |\n| Borée |  |'
    )
  })

  it('writes the table alone without a caption, and keeps a pipe in a cell', () => {
    expect(
      makeTableMarkdown({
        caption: '',
        columns: ['Option'],
        rows: [['A | B'], ['une\nligne']]
      })
    ).toBe('| Option |\n| --- |\n| A \\| B |\n| une ligne |')
  })

  it('keeps a backslash in a cell, even before a pipe', () => {
    expect(
      makeTableMarkdown({
        caption: '',
        columns: ['Chemin'],
        rows: [['C:\\Lots'], ['fin \\| suite']]
      })
    ).toBe('| Chemin |\n| --- |\n| C:\\\\Lots |\n| fin \\\\\\| suite |')
  })
})
