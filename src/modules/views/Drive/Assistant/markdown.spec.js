import {
  parseInlines,
  parseMarkdown
} from '@/modules/views/Drive/Assistant/markdown'

describe('parseInlines', () => {
  it('reads bold and italic text', () => {
    expect(parseInlines('a **b** *c* _d_ ***e***')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' ' },
      { text: 'd', italic: true },
      { text: ' ' },
      { text: 'e', bold: true, italic: true }
    ])
  })

  it('keeps a lone star as text', () => {
    expect(parseInlines('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15' }])
  })
})

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and lists', () => {
    expect(
      parseMarkdown(
        '## Steps\nfirst line\nsecond line\n\n- a\n- b\n1. one\n2. two'
      )
    ).toEqual([
      { type: 'heading', level: 2, inlines: [{ text: 'Steps' }] },
      { type: 'paragraph', inlines: [{ text: 'first line second line' }] },
      {
        type: 'list',
        ordered: false,
        items: [[{ text: 'a' }], [{ text: 'b' }]]
      },
      {
        type: 'list',
        ordered: true,
        items: [[{ text: 'one' }], [{ text: 'two' }]]
      }
    ])
  })
})
