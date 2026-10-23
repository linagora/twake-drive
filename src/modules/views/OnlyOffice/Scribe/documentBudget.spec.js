import { cutDocument } from '@/modules/views/OnlyOffice/Scribe/documentBudget'

const TEXT = 'a\n\nbb\n\nccc'

describe('cutDocument', () => {
  it('keeps the text without a budget', () => {
    for (const budget of [undefined, null, 0, -5]) {
      expect(cutDocument(TEXT, budget)).toEqual({
        document: TEXT,
        isTruncated: false
      })
    }
  })

  it('cuts at the last paragraph break within the budget', () => {
    expect(cutDocument(TEXT, 5)).toEqual({
      document: 'a\n\nbb',
      isTruncated: true
    })
    expect(cutDocument(TEXT, 4)).toEqual({ document: 'a', isTruncated: true })
  })

  it('keeps a text that fits', () => {
    expect(cutDocument(TEXT, TEXT.length)).toEqual({
      document: TEXT,
      isTruncated: false
    })
    expect(cutDocument(TEXT, 100)).toEqual({
      document: TEXT,
      isTruncated: false
    })
  })

  it('cuts at the budget a text without a paragraph break in it', () => {
    expect(cutDocument('abcdef\n\ng', 3)).toEqual({
      document: 'abc',
      isTruncated: true
    })
    expect(cutDocument('\n\nabcdef', 3)).toEqual({
      document: '\n\na',
      isTruncated: true
    })
  })
})
