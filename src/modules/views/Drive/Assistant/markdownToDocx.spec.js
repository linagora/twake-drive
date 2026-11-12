import { strFromU8, unzipSync } from 'fflate'

import {
  makeDocxParts,
  markdownToDocx
} from '@/modules/views/Drive/Assistant/markdownToDocx'

describe('markdownToDocx', () => {
  it('starts the document with its title as first heading', () => {
    const document = makeDocxParts('Atlas & co', '## Status\nOn **time**.')[
      'word/document.xml'
    ]
    expect(document).toContain(
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">Atlas &amp; co</w:t></w:r></w:p>'
    )
    expect(document).toContain('<w:pStyle w:val="Heading2"/>')
    expect(document).toContain(
      '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">time</w:t></w:r>'
    )
  })

  it('restarts the numbering of each ordered list', () => {
    const parts = makeDocxParts('Plan', '1. a\n2. b\n\ntext\n\n1. c\n\n- d')
    const document = parts['word/document.xml']
    expect(document.match(/<w:numId w:val="2"\/>/g)).toHaveLength(2)
    expect(document.match(/<w:numId w:val="3"\/>/g)).toHaveLength(1)
    expect(document.match(/<w:numId w:val="1"\/>/g)).toHaveLength(1)
    expect(parts['word/numbering.xml']).toContain(
      '<w:num w:numId="3"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/>'
    )
  })

  it('packages the parts in a zip', () => {
    const files = unzipSync(markdownToDocx('Plan', 'text'))
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/_rels/document.xml.rels',
      'word/document.xml',
      'word/numbering.xml',
      'word/styles.xml'
    ])
    expect(strFromU8(files['word/document.xml'])).toContain('Plan')
  })
})
