// The style ids (Heading1-3, ListParagraph) are the built-in ones of Word, so
// that OnlyOffice reads them as real headings and lists.

import { strToU8, zipSync } from 'fflate'

import { parseMarkdown } from '@/modules/views/Drive/Assistant/markdown'

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const BULLET_NUM_ID = 1
// Deeper lists are written at the last level
const LIST_LEVELS = 3
const LIST_INDENT = 720

// XML 1.0 forbids these control characters: one of them in the text of the
// assistant would make a document Word and OnlyOffice cannot open
// eslint-disable-next-line no-control-regex
const XML_FORBIDDEN_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

const escapeXml = text =>
  text
    .replace(XML_FORBIDDEN_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const toRuns = inlines =>
  inlines
    .map(inline => {
      const props = `${inline.bold ? '<w:b/>' : ''}${
        inline.italic ? '<w:i/>' : ''
      }`
      return `<w:r>${
        props ? `<w:rPr>${props}</w:rPr>` : ''
      }<w:t xml:space="preserve">${escapeXml(inline.text)}</w:t></w:r>`
    })
    .join('')

const toParagraph = (inlines, properties = '') =>
  `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${toRuns(
    inlines
  )}</w:p>`

const toHeading = block =>
  toParagraph(
    block.inlines,
    `<w:pStyle w:val="Heading${Math.min(block.level, 3)}"/>`
  )

// Each ordered list gets its own numId, or its numbering would go on from the
// previous list instead of restarting at 1
const pickNumId = (block, orderedNumIds) => {
  if (!block.ordered) return BULLET_NUM_ID
  const numId = BULLET_NUM_ID + orderedNumIds.length + 1
  orderedNumIds.push(numId)
  return numId
}

// The first paragraph of an item carries its number or bullet, the next ones
// are only indented
const toListParagraph = (inlines, level, numId) =>
  toParagraph(
    inlines,
    `<w:pStyle w:val="ListParagraph"/>${
      numId === null
        ? `<w:ind w:left="${LIST_INDENT * (level + 1)}"/>`
        : `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`
    }`
  )

const toListParagraphs = (list, depth, orderedNumIds) => {
  const numId = pickNumId(list, orderedNumIds)
  const level = Math.min(depth, LIST_LEVELS - 1)
  return list.items.flatMap(item =>
    item.flatMap((block, index) =>
      block.type === 'list'
        ? toListParagraphs(block, depth + 1, orderedNumIds)
        : [toListParagraph(block.inlines, level, index === 0 ? numId : null)]
    )
  )
}

const toBlockParagraphs = (block, orderedNumIds) => {
  if (block.type === 'heading') return [toHeading(block)]
  if (block.type === 'list') return toListParagraphs(block, 0, orderedNumIds)
  return [toParagraph(block.inlines)]
}

const toBody = blocks => {
  const orderedNumIds = []
  const paragraphs = blocks.flatMap(block =>
    toBlockParagraphs(block, orderedNumIds)
  )
  return { paragraphs, orderedNumIds }
}

const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

const documentXml = paragraphs =>
  // An A4 page with margins of 2.5 cm, in twentieths of a point (OOXML twips)
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W_NS}><w:body>${paragraphs.join(
    ''
  )}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`

const headingStyle = (level, size) =>
  `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${
    level === 1 ? 360 : 240
  }" w:after="120"/><w:outlineLvl w:val="${
    level - 1
  }"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${headingStyle(
  1,
  36
)}${headingStyle(2, 28)}${headingStyle(
  3,
  24
)}<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style></w:styles>`

const LEVELS = [...Array(LIST_LEVELS).keys()]
const BULLETS = ['•', '◦', '▪']

const numberingXml = orderedNumIds => {
  const levels = (format, makeText) =>
    LEVELS.map(
      level =>
        `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${makeText(
          level
        )}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${
          LIST_INDENT * (level + 1)
        }" w:hanging="360"/></w:pPr></w:lvl>`
    ).join('')
  const restarts = LEVELS.map(
    level =>
      `<w:lvlOverride w:ilvl="${level}"><w:startOverride w:val="1"/></w:lvlOverride>`
  ).join('')
  const ordered = orderedNumIds
    .map(
      numId =>
        `<w:num w:numId="${numId}"><w:abstractNumId w:val="1"/>${restarts}</w:num>`
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${W_NS}><w:abstractNum w:abstractNumId="0">${levels(
    'bullet',
    level => BULLETS[level]
  )}</w:abstractNum><w:abstractNum w:abstractNumId="1">${levels(
    'decimal',
    level => `%${level + 1}.`
  )}</w:abstractNum><w:num w:numId="${BULLET_NUM_ID}"><w:abstractNumId w:val="0"/></w:num>${ordered}</w:numbering>`
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`

/**
 * Exported for the tests: the XML parts of the .docx package, by path
 *
 * @returns {Record<string, string>}
 */
export const makeDocxParts = (title, markdown) => {
  const blocks = [
    { type: 'heading', level: 1, inlines: [{ text: title }] },
    ...parseMarkdown(markdown)
  ]
  const { paragraphs, orderedNumIds } = toBody(blocks)
  return {
    '[Content_Types].xml': CONTENT_TYPES_XML,
    '_rels/.rels': RELS_XML,
    'word/_rels/document.xml.rels': DOCUMENT_RELS_XML,
    'word/document.xml': documentXml(paragraphs),
    'word/styles.xml': STYLES_XML,
    'word/numbering.xml': numberingXml(orderedNumIds)
  }
}

/**
 * @param {string} title - written as the first heading of the document
 * @returns {Uint8Array}
 */
export const markdownToDocx = (title, markdown) => {
  const parts = makeDocxParts(title, markdown)
  return zipSync(
    Object.fromEntries(
      Object.entries(parts).map(([path, xml]) => [path, strToU8(xml)])
    )
  )
}
