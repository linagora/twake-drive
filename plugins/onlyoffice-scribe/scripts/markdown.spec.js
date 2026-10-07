import { makeBlocks, makeLineSpans, makeLines } from './markdown'

const paragraph = (...spans) => ({ type: 'paragraph', spans })

describe('makeBlocks', () => {
  it('gives no block for an empty answer', () => {
    expect(makeBlocks('')).toEqual([])
    expect(makeBlocks('\n\n')).toEqual([])
  })

  it('reads the paragraphs with the marks of their text', () => {
    const blocks = makeBlocks(
      'Un **gras**, un *italique*, un ~~barré~~ et du `code`.\n\nUn ***gras italique***.'
    )

    expect(blocks).toEqual([
      paragraph(
        { text: 'Un ' },
        { text: 'gras', isBold: true },
        { text: ', un ' },
        { text: 'italique', isItalic: true },
        { text: ', un ' },
        { text: 'barré', isStrike: true },
        { text: ' et du ' },
        { text: 'code', isCode: true },
        { text: '.' }
      ),
      paragraph(
        { text: 'Un ' },
        { text: 'gras italique', isItalic: true, isBold: true },
        { text: '.' }
      )
    ])
  })

  it('reads a line break of the source as a space, and a hard one as a break', () => {
    expect(makeBlocks('une ligne\nla suite  \nune autre')).toEqual([
      paragraph(
        { text: 'une ligne la suite' },
        { isBreak: true },
        { text: 'une autre' }
      )
    ])
  })

  it('decodes the entities the editor writes in its Markdown', () => {
    expect(makeBlocks('a &lt; b &amp; c &#233; &#x2014; &unknown;')).toEqual([
      paragraph({ text: 'a < b & c é — &unknown;' })
    ])
  })

  it('reads the headings with their level', () => {
    expect(makeBlocks('# Titre\n\n### Sous-titre **important**')).toEqual([
      { type: 'heading', level: 1, spans: [{ text: 'Titre' }] },
      {
        type: 'heading',
        level: 3,
        spans: [{ text: 'Sous-titre ' }, { text: 'important', isBold: true }]
      }
    ])
  })

  it('reads the items of a list with their depth, each list apart', () => {
    const blocks = makeBlocks(
      '- un\n  - dedans\n- deux\n\nUn texte.\n\n1. premier\n2. second'
    )

    expect(blocks).toEqual([
      {
        type: 'listItem',
        listId: 1,
        isOrdered: false,
        depth: 0,
        spans: [{ text: 'un' }]
      },
      {
        type: 'listItem',
        listId: 2,
        isOrdered: false,
        depth: 1,
        spans: [{ text: 'dedans' }]
      },
      {
        type: 'listItem',
        listId: 1,
        isOrdered: false,
        depth: 0,
        spans: [{ text: 'deux' }]
      },
      paragraph({ text: 'Un texte.' }),
      {
        type: 'listItem',
        listId: 3,
        isOrdered: true,
        depth: 0,
        spans: [{ text: 'premier' }]
      },
      {
        type: 'listItem',
        listId: 3,
        isOrdered: true,
        depth: 0,
        spans: [{ text: 'second' }]
      }
    ])
  })

  it('writes the boxes of a task list in its items', () => {
    const blocks = makeBlocks('- [x] fait\n- [ ] à faire')

    expect(blocks.map(block => block.spans)).toEqual([
      [{ text: '☑ ' }, { text: 'fait' }],
      [{ text: '☐ ' }, { text: 'à faire' }]
    ])
  })

  it('reads a quote and a block of code', () => {
    expect(
      makeBlocks('> Une **citation**.\n\n```js\nconst a = 1\n\nb()\n```')
    ).toEqual([
      {
        type: 'quote',
        spans: [
          { text: 'Une ' },
          { text: 'citation', isBold: true },
          { text: '.' }
        ]
      },
      paragraph(
        { text: 'const a = 1', isCode: true },
        { isBreak: true },
        { isBreak: true },
        { text: 'b()', isCode: true }
      )
    ])
  })

  it('reads a table, its header in bold', () => {
    expect(
      makeBlocks('| Lot | Montant |\n|---|---|\n| Atlas | **42** |')
    ).toEqual([
      {
        type: 'table',
        rows: [
          [
            { spans: [{ text: 'Lot', isBold: true }] },
            { spans: [{ text: 'Montant', isBold: true }] }
          ],
          [
            { spans: [{ text: 'Atlas' }] },
            { spans: [{ text: '42', isBold: true }] }
          ]
        ]
      }
    ])
  })

  it('reads a table in HTML tags, the way the editor gives its own', () => {
    const blocks = makeBlocks(
      'Avant.\n\n<table>\n  <tr>\n   <td>\n\nLot\n\n</td>\n   <td>\n\n**Montant**\n\nHT\n\n</td>\n  </tr>\n  <tr>\n   <td>Atlas</td><td>42 000 €</td>\n  </tr>\n</table>\n\nAprès.'
    )

    expect(blocks).toEqual([
      paragraph({ text: 'Avant.' }),
      {
        type: 'table',
        rows: [
          [
            { spans: [{ text: 'Lot' }] },
            {
              spans: [
                { text: 'Montant', isBold: true },
                { isBreak: true },
                { text: 'HT' }
              ]
            }
          ],
          [{ spans: [{ text: 'Atlas' }] }, { spans: [{ text: '42 000 €' }] }]
        ]
      },
      paragraph({ text: 'Après.' })
    ])
  })

  it('reads the columns and rows a cell takes', () => {
    const blocks = makeBlocks(
      '<table><tr><td>Lot</td><td colspan="2">Budget</td></tr><tr><td rowspan=2>Atlas</td><td>Étude</td><td>12</td></tr><tr><td>Réalisation</td><td>30</td></tr></table>'
    )

    expect(blocks).toEqual([
      {
        type: 'table',
        rows: [
          [
            { spans: [{ text: 'Lot' }] },
            { spans: [{ text: 'Budget' }], colSpan: 2 }
          ],
          [
            { spans: [{ text: 'Atlas' }], rowSpan: 2 },
            { spans: [{ text: 'Étude' }] },
            { spans: [{ text: '12' }] }
          ],
          [{ spans: [{ text: 'Réalisation' }] }, { spans: [{ text: '30' }] }]
        ]
      }
    ])
  })

  it('gives what a table left open holds', () => {
    expect(makeBlocks('<table><tr><td>Lot</td>')).toEqual([
      { type: 'table', rows: [[{ spans: [{ text: 'Lot' }] }]] }
    ])
  })

  it('unwraps an answer given as a whole in quotes or in a fence', () => {
    expect(makeBlocks('"""\nUn **texte**.\n"""')).toEqual([
      paragraph({ text: 'Un ' }, { text: 'texte', isBold: true }, { text: '.' })
    ])
    expect(
      makeBlocks('```html\n<table><tr><td>Lot</td></tr></table>\n```')
    ).toEqual([{ type: 'table', rows: [[{ spans: [{ text: 'Lot' }] }]] }])
    expect(makeBlocks('```\n# Titre\n```\n')).toEqual([
      { type: 'heading', level: 1, spans: [{ text: 'Titre' }] }
    ])
  })

  it('keeps the code of a fence in another language, and a fence among other blocks', () => {
    expect(makeBlocks('```js\nconst a = 1\n```')).toEqual([
      paragraph({ text: 'const a = 1', isCode: true })
    ])
    expect(makeBlocks('Avant.\n\n```\nUn **texte**.\n```')).toEqual([
      paragraph({ text: 'Avant.' }),
      paragraph({ text: 'Un **texte**.', isCode: true })
    ])
  })

  it('keeps the web and mail links, and the text of the others', () => {
    const blocks = makeBlocks(
      '[le site **Twake**](https://twake.app), [un mail](mailto:a@b.c), [un piège](javascript:alert(1))'
    )

    expect(blocks).toEqual([
      paragraph(
        { text: 'le site Twake', href: 'https://twake.app' },
        { text: ', ' },
        { text: 'un mail', href: 'mailto:a@b.c' },
        { text: ', ' },
        { text: 'un piège' }
      )
    ])
  })

  it('leaves the HTML tags out, and loads no image', () => {
    const blocks = makeBlocks(
      'Un <u>souligné</u><br>puis ![une image](https://example.org/a.png)\n\n<div onclick="alert(1)">Un bloc</div>'
    )

    expect(blocks).toEqual([
      paragraph(
        { text: 'Un ' },
        { text: 'souligné' },
        { isBreak: true },
        { text: 'puis ' },
        { text: 'une image' }
      ),
      paragraph({ text: 'Un bloc' })
    ])
  })
})

describe('makeLines', () => {
  it('gives the text of the blocks, one line each, without the marks', () => {
    const lines = makeLines(
      makeBlocks(
        '# Nouveautés\n\n- Un **partage** refait\n- Une recherche *rapide*\n\nUne phrase  \nsur deux lignes.\n\n| Lot | Montant |\n|---|---|\n| Atlas | 42 |'
      )
    )

    expect(lines).toEqual([
      'Nouveautés',
      'Un partage refait',
      'Une recherche rapide',
      'Une phrase',
      'sur deux lignes.',
      'Lot | Montant',
      'Atlas | 42'
    ])
  })

  it('breaks the lines at the line breaks of the source when asked to', () => {
    const markdown = 'Partage sécurisé\nRecherche rapide\n\nAssistant intégré'

    expect(makeLines(makeBlocks(markdown))).toEqual([
      'Partage sécurisé Recherche rapide',
      'Assistant intégré'
    ])
    expect(makeLines(makeBlocks(markdown, { hasLineBreaks: true }))).toEqual([
      'Partage sécurisé',
      'Recherche rapide',
      'Assistant intégré'
    ])
  })

  it('gives no line for an empty answer', () => {
    expect(makeLines(makeBlocks(''))).toEqual([])
  })
})

describe('makeLineSpans', () => {
  it('gives the lines with the emphasis of their text', () => {
    const lines = makeLineSpans(
      makeBlocks('- Un **partage** refait\n- Une recherche *rapide*', {
        hasLineBreaks: true
      })
    )

    expect(lines).toEqual([
      [{ text: 'Un ' }, { text: 'partage', isBold: true }, { text: ' refait' }],
      [{ text: 'Une recherche ' }, { text: 'rapide', isItalic: true }]
    ])
  })

  it('leaves out the spaces around a line, whatever spans hold them', () => {
    const lines = makeLineSpans(
      makeBlocks('Une phrase  \n**sur deux** lignes.', { hasLineBreaks: true })
    )

    expect(lines).toEqual([
      [{ text: 'Une phrase' }],
      [{ text: 'sur deux', isBold: true }, { text: ' lignes.' }]
    ])
  })

  it('joins the cells of a row', () => {
    const lines = makeLineSpans(
      makeBlocks('| Lot | Montant |\n|---|---|\n| **Atlas** | 42 |')
    )

    expect(lines).toEqual([
      [
        { text: 'Lot', isBold: true },
        { text: ' | ' },
        { text: 'Montant', isBold: true }
      ],
      [{ text: 'Atlas', isBold: true }, { text: ' | ' }, { text: '42' }]
    ])
  })
})
