import { makeBlocks, makeLineSpans, makeLines } from './markdown'

const paragraph = (...spans) => ({ type: 'paragraph', spans })
const code = (...lines) => ({ type: 'code', lines })

describe('makeBlocks', () => {
  it('gives no block for an empty answer', () => {
    expect(makeBlocks('')).toEqual([])
    expect(makeBlocks('\n\n')).toEqual([])
    expect(makeBlocks('```js\n```')).toEqual([])
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

  it('nests the lists the LLM indents by 2 spaces under a numbered item', () => {
    const blocks = makeBlocks(
      [
        '1. First item',
        '2. Second item',
        '  1. Numbered sub-item',
        '  2. Another sub-item',
        '    1. Even deeper level',
        '    2. Continuation',
        '3. Third item',
        '  - First bullet',
        '  - Second bullet'
      ].join('\n')
    )

    expect(
      blocks.map(({ depth, isOrdered, spans }) => [
        depth,
        isOrdered,
        spans.map(span => span.text).join('')
      ])
    ).toEqual([
      [0, true, 'First item'],
      [0, true, 'Second item'],
      [1, true, 'Numbered sub-item'],
      [1, true, 'Another sub-item'],
      [2, true, 'Even deeper level'],
      [2, true, 'Continuation'],
      [0, true, 'Third item'],
      [1, false, 'First bullet'],
      [1, false, 'Second bullet']
    ])
  })

  it('nests a list under an item whose number takes more room', () => {
    const blocks = makeBlocks('9. neuf\n10. dix\n  - dedans')

    expect(blocks.map(block => block.depth)).toEqual([0, 0, 1])
  })

  it('leaves an indented block of code out of the lists', () => {
    const blocks = makeBlocks('Un texte.\n\n    - pas une liste')

    expect(blocks[1]).toEqual(code('- pas une liste'))
  })

  it('leaves the code of a fence in a list item as it is', () => {
    const blocks = makeBlocks(
      '10. Configure:\n    ```yaml\n    steps:\n      - run: build\n    ```'
    )

    expect(blocks[1]).toEqual(code('steps:', '  - run: build'))
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
      code('const a = 1', ' ', 'b()')
    ])
  })

  it('gives a fenced block as a code block, one line each, an empty line a space', () => {
    expect(makeBlocks('```js\nconst a = 1\n\nconst b = 2\n```')).toEqual([
      { type: 'code', lines: ['const a = 1', ' ', 'const b = 2'] }
    ])
  })

  it('keeps markers as text inside a code block', () => {
    expect(
      makeBlocks('```js\n<u>a</u> ![image 1] [^scribe-fn-1]\n```')
    ).toEqual([{ type: 'code', lines: ['<u>a</u> ![image 1] [^scribe-fn-1]'] }])
    expect(makeBlocks('`[^scribe-fn-1]`')[0].spans).toEqual([
      { text: '[^scribe-fn-1]', isCode: true }
    ])
    expect(makeBlocks('`{{REF:scribe-ref-1:a}}`')[0].spans).toEqual([
      { text: '{{REF:scribe-ref-1:a}}', isCode: true }
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
              ],
              blocks: [
                paragraph({ text: 'Montant', isBold: true }),
                paragraph({ text: 'HT' })
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

  it('writes a block of code in a cell of a table in HTML tags as its text', () => {
    expect(
      makeBlocks('<table><tr><td>\n\n```js\na\nb\n```\n\n</td></tr></table>')
    ).toEqual([
      {
        type: 'table',
        rows: [
          [
            {
              spans: [
                { text: 'a', isCode: true },
                { isBreak: true },
                { text: 'b', isCode: true }
              ]
            }
          ]
        ]
      }
    ])
  })

  it('keeps the paragraphs of an HTML cell as its blocks', () => {
    const [table] = makeBlocks(
      '<table><tr><td>\n\nOne\n\nTwo\n\n</td></tr></table>'
    )
    expect(table.rows[0][0].blocks.map(b => b.spans[0].text)).toEqual([
      'One',
      'Two'
    ])
    expect(table.rows[0][0].spans).toEqual([
      { text: 'One' },
      { isBreak: true },
      { text: 'Two' }
    ])
  })

  it('gives each block of an HTML cell its spans, the lines of a block of code in one', () => {
    const [table] = makeBlocks(
      '<table><tr><td>\n\n# Title\n\n```js\na\nb\n```\n\n</td></tr></table>'
    )

    expect(table.rows[0][0].blocks.map(block => block.spans)).toEqual([
      [{ text: 'Title' }],
      [
        { text: 'a', isCode: true },
        { isBreak: true },
        { text: 'b', isCode: true }
      ]
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
    expect(makeBlocks('```js\nconst a = 1\n```')).toEqual([code('const a = 1')])
    expect(makeBlocks('Avant.\n\n```\nUn **texte**.\n```')).toEqual([
      paragraph({ text: 'Avant.' }),
      code('Un **texte**.')
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

  it('marks the text between <u> tags as underlined, with the other marks', () => {
    expect(makeBlocks('a <u>b **c**</u> d')[0].spans).toEqual([
      { text: 'a ' },
      { text: 'b ', isUnderline: true },
      { text: 'c', isUnderline: true, isBold: true },
      { text: ' d' }
    ])
  })

  it('underlines the text of a link', () => {
    expect(makeBlocks('<u>[x](https://a.b)</u>')[0].spans).toEqual([
      { text: 'x', href: 'https://a.b', isUnderline: true }
    ])
  })

  it('underlines a link whose whole text is underlined, as the editor gives it', () => {
    expect(
      makeBlocks('[<u>x</u>](https://a.b) [<u>y</u> z](https://a.b)')[0].spans
    ).toEqual([
      { text: 'x', href: 'https://a.b', isUnderline: true },
      { text: ' ' },
      { text: 'y z', href: 'https://a.b' }
    ])
  })

  it('underlines a code span between <u> tags, and keeps the tags of a code span as its text', () => {
    expect(makeBlocks('<u>`a`</u> `<u>b</u>`')[0].spans).toEqual([
      { text: 'a', isCode: true, isUnderline: true },
      { text: ' ' },
      { text: '<u>b</u>', isCode: true }
    ])
  })

  it('keeps the emphasis of an underlined part of a word', () => {
    expect(makeBlocks('x<u>*a*</u>y 中文<u>**粗体**</u>中文')[0].spans).toEqual(
      [
        { text: 'x' },
        { text: 'a', isUnderline: true, isItalic: true },
        { text: 'y 中文' },
        { text: '粗体', isUnderline: true, isBold: true },
        { text: '中文' }
      ]
    )
  })

  it('keeps the underline of a text in an HTML cell without a line break', () => {
    expect(makeBlocks('<table><tr><td>a <u>b</u> c</td></tr></table>')).toEqual(
      [
        {
          type: 'table',
          rows: [
            [
              {
                spans: [
                  { text: 'a ' },
                  { text: 'b', isUnderline: true },
                  { text: ' c' }
                ]
              }
            ]
          ]
        }
      ]
    )
  })

  it('gives a footnote marker as a note span', () => {
    expect(makeBlocks('a[^scribe-fn-2] b')[0].spans).toEqual([
      { text: 'a' },
      { note: 2 },
      { text: ' b' }
    ])
  })

  it('gives a footnote marker of a link text after the link', () => {
    expect(
      makeBlocks('[a[^scribe-fn-1] b](https://a.b) [c[^scribe-fn-2]](x:y)')[0]
        .spans
    ).toEqual([
      { text: 'a b', href: 'https://a.b' },
      { note: 1 },
      { text: ' ' },
      { text: 'c' },
      { note: 2 }
    ])
  })

  it('gives a reference marker as a ref span with its text', () => {
    expect(makeBlocks('see {{REF:scribe-ref-1:Budget}} now')[0].spans).toEqual([
      { text: 'see ' },
      { ref: 1, text: 'Budget' },
      { text: ' now' }
    ])
    expect(
      makeBlocks('**{{REF:scribe-ref-2:R&amp;D}}**{{REF:scribe-ref-3:}}')[0]
        .spans
    ).toEqual([{ ref: 2, text: 'R&D', isBold: true }])
  })

  it('gives a reference marker of a link text as text of the link', () => {
    expect(
      makeBlocks(
        '[see {{REF:scribe-ref-1:Budget}}](https://a.b) [{{REF:scribe-ref-2:c}}](x:y)'
      )[0].spans
    ).toEqual([
      { text: 'see Budget', href: 'https://a.b' },
      { text: ' ' },
      { text: 'c' }
    ])
  })

  it('leaves the HTML tags out, and loads no image', () => {
    const blocks = makeBlocks(
      'Un <span>souligné</span><br>puis ![une image](https://example.org/a.png)\n\n<div onclick="alert(1)">Un bloc</div>'
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

  it('still gives the lines of a code block to a presentation', () => {
    expect(makeLines(makeBlocks('```js\na\nb\n```'))).toEqual(['a', 'b'])
  })

  it('leaves the empty lines of a code block, and the indent of its lines, out of a presentation', () => {
    expect(makeLines(makeBlocks('```js\na\n\n  b\n```'))).toEqual(['a', 'b'])
  })

  it('gives a footnote marker to a presentation as its text', () => {
    expect(makeLines(makeBlocks('[^scribe-fn-1] a[^scribe-fn-2]'))).toEqual([
      '[^scribe-fn-1] a[^scribe-fn-2]'
    ])
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
