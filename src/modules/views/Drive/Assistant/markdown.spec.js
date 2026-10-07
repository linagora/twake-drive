import { parseMarkdown } from '@/modules/views/Drive/Assistant/markdown'

const paragraph = text => ({ type: 'paragraph', inlines: [{ text }] })

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and lists', () => {
    expect(
      parseMarkdown(
        '## Steps\nfirst line\nsecond line\n\n- a\n- b\n\n1. one\n2. two'
      )
    ).toEqual([
      { type: 'heading', level: 2, inlines: [{ text: 'Steps' }] },
      paragraph('first line second line'),
      {
        type: 'list',
        ordered: false,
        items: [[paragraph('a')], [paragraph('b')]]
      },
      {
        type: 'list',
        ordered: true,
        items: [[paragraph('one')], [paragraph('two')]]
      }
    ])
  })

  it('reads bold and italic text, not an underscore inside a word', () => {
    expect(
      parseMarkdown('a **b** *c* ***e*** rapport_2025_final.pdf')[0].inlines
    ).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' ' },
      { text: 'e', bold: true, italic: true },
      { text: ' rapport_2025_final.pdf' }
    ])
  })

  it('keeps one list across blank lines and a nested list', () => {
    const [list] = parseMarkdown('1. A\n\n2. B\n   - sub\n\n3. C')
    expect(list.items).toEqual([
      [paragraph('A')],
      [
        paragraph('B'),
        { type: 'list', ordered: false, items: [[paragraph('sub')]] }
      ],
      [paragraph('C')]
    ])
  })

  it('keeps a wrapped line starting with a number in its paragraph', () => {
    expect(parseMarkdown('In the plan for\n2026. A new year')).toEqual([
      paragraph('In the plan for 2026. A new year')
    ])
  })

  it('writes a code block as text, and the address of a link', () => {
    expect(
      parseMarkdown('```\n# x\n- y\n```\n\nSee [the site](https://x.org).')
    ).toEqual([
      paragraph('# x'),
      paragraph('- y'),
      {
        type: 'paragraph',
        inlines: [
          { text: 'See ' },
          { text: 'the site' },
          { text: ' (https://x.org)' },
          { text: '.' }
        ]
      }
    ])
  })
})
