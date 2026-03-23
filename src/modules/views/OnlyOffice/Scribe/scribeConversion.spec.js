import { htmlToMarkdown, markdownToHtml, normalizeHtml } from './scribeConversion'

describe('scribeConversion', () => {
  describe('htmlToMarkdown', () => {
    it('converts bold inline style to markdown bold', () => {
      const html = '<span style="font-weight:bold">hello</span>'
      expect(htmlToMarkdown(html)).toBe('**hello**')
    })

    it('converts italic inline style to markdown italic', () => {
      const html = '<span style="font-style:italic">hello</span>'
      expect(htmlToMarkdown(html)).toBe('*hello*')
    })

    it('converts combined bold+italic inline style', () => {
      const html =
        '<span style="font-weight:bold;font-style:italic">hello</span>'
      expect(htmlToMarkdown(html)).toBe('***hello***')
    })

    it('converts numeric font-weight 700 to bold', () => {
      const html = '<span style="font-weight:700">hello</span>'
      expect(htmlToMarkdown(html)).toBe('**hello**')
    })

    it('preserves blank lines between paragraphs', () => {
      const html = '<p>text</p><p>&nbsp;</p><p>more</p>'
      const md = htmlToMarkdown(html)
      expect(md).toContain('text')
      expect(md).toContain('more')
      // Should have a blank line (double newline) between text and more
      expect(md).toMatch(/text\n\n[\n]*more/)
    })

    it('strips img elements silently', () => {
      const html = '<p>text<img src="x.png">more</p>'
      expect(htmlToMarkdown(html)).toBe('textmore')
    })

    it('strips svg, math, object, embed, iframe elements', () => {
      const html =
        '<p>before<svg><circle/></svg><math><mi>x</mi></math><object></object><embed/><iframe></iframe>after</p>'
      expect(htmlToMarkdown(html)).toBe('beforeafter')
    })

    it('returns empty string for empty input', () => {
      expect(htmlToMarkdown('')).toBe('')
      expect(htmlToMarkdown(null)).toBe('')
      expect(htmlToMarkdown(undefined)).toBe('')
    })

    it('passes through already-semantic strong tags', () => {
      const html = '<strong>already semantic</strong>'
      expect(htmlToMarkdown(html)).toBe('**already semantic**')
    })

    it('converts headings', () => {
      const html = '<h2>Title</h2>'
      expect(htmlToMarkdown(html)).toBe('## Title')
    })

    it('converts unordered lists', () => {
      const html = '<ul><li>a</li><li>b</li></ul>'
      const md = htmlToMarkdown(html)
      expect(md).toContain('- ')
      expect(md).toContain('a')
      expect(md).toContain('b')
      expect(md.split('\n').filter(l => l.trim().startsWith('-'))).toHaveLength(2)
    })

    it('preserves underline tags through htmlToMarkdown', () => {
      const html = '<u>underlined</u>'
      expect(htmlToMarkdown(html)).toBe('<u>underlined</u>')
    })

    it('preserves bold inside underline through htmlToMarkdown', () => {
      const html = '<u><strong>bold underlined</strong></u>'
      const md = htmlToMarkdown(html)
      expect(md).toContain('<u>')
      expect(md).toContain('</u>')
      expect(md).toContain('**bold underlined**')
    })

    it('converts GFM tables', () => {
      const html =
        '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
      const md = htmlToMarkdown(html)
      expect(md).toContain('| A | B |')
      expect(md).toContain('| 1 | 2 |')
    })
  })

  describe('normalizeHtml', () => {
    it('merges adjacent underline tags', () => {
      const html = '<u>hello</u><u> world</u>'
      const result = normalizeHtml(html)
      expect(result).toBe('<u>hello world</u>')
    })
  })

  describe('markdownToHtml', () => {
    it('converts bold markdown to strong HTML', () => {
      const html = markdownToHtml('**bold**')
      expect(html).toContain('<strong>bold</strong>')
    })

    it('converts italic markdown to em HTML', () => {
      const html = markdownToHtml('*italic*')
      expect(html).toContain('<em>italic</em>')
    })

    it('converts heading markdown to h2 HTML', () => {
      const html = markdownToHtml('## Heading')
      expect(html).toContain('<h2>Heading</h2>')
    })

    it('converts list markdown to ul/li HTML', () => {
      const html = markdownToHtml('- item1\n- item2')
      expect(html).toContain('<ul>')
      expect(html).toContain('<li>item1</li>')
      expect(html).toContain('<li>item2</li>')
    })

    it('converts GFM pipe table to HTML table', () => {
      const html = markdownToHtml('| A | B |\n| --- | --- |\n| 1 | 2 |')
      expect(html).toContain('<table>')
      expect(html).toContain('<td>1</td>')
    })

    it('returns empty string for empty input', () => {
      expect(markdownToHtml('')).toBe('')
      expect(markdownToHtml(null)).toBe('')
    })
  })
})
