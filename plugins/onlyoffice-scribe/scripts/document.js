/* global Api, Asc */

// The functions of this file run inside the editor: the plugin sends their
// source to it with `callCommand`. They cannot use anything defined outside
// of them, and their parameters come in `Asc.scope`.

/**
 * Reads the text the scribe works on: the selection, or the whole document
 * without one. The Markdown of the editor gives the tables in HTML tags, one
 * cell after the other: the cells that take several columns or rows get
 * their `colspan` and `rowspan`. A footnote of the selection is the marker
 * `[^scribe-fn-N]`, N from 1, and the N-th text of `notes` is the first
 * paragraph of that note, in plain text. A link to a heading or a bookmark of
 * the document is the marker `{{REF:scribe-ref-N:text}}`, and the N-th item
 * of `refs` the `anchor` it goes to and its `kind`, `heading` or `bookmark`.
 * The K-th drawing of the selection, K from 1 in their order, is the marker
 * `![image K]`, and a picture of the whole document `[image]`; `imageCount`
 * counts the drawings numbered.
 *
 * @param {boolean} [isCursorKept] - the cursor is in the text of a shape,
 * where the editor converts no selection: it is left there
 * @returns {{ content: string, target: 'selection' | 'document',
 * canReplace: boolean, notes: string[], refs: object[],
 * imageCount: number }} the text, in Markdown, whether an answer can take its
 * place, and what its markers stand for
 */
export function readContent(isCursorKept = false) {
  const doc = Api.GetDocument()
  const selection = doc.GetRangeBySelect()
  const hasSelection =
    Boolean(selection) && selection.GetText({ Numbering: false }).trim() !== ''
  // The editor converts the selection when there is one, even an empty one
  if (!hasSelection && !isCursorKept) doc.RemoveSelection()
  // The editor gives no paragraphs for a selection it does not let change,
  // as one that holds a locked content control: it is not replaced
  const selected = hasSelection ? selection.GetAllParagraphs() : []
  const isLocked = selected === null
  const paragraphs = selected ?? []
  const selectionJson =
    paragraphs.length > 0 ? selection.ToJSON(false, false) : ''
  const NOTE_REFERENCE = /"type":"footnoteRef"/
  const notes = []
  const refs = []
  // A note or a drawing the content gives no marker for, which an answer
  // would lose
  let hasUnmarkedNote = false
  let hasUnmarkedDrawing = false

  // The runs of a paragraph, those of its links included
  const getRuns = paragraph => {
    const runs = []
    for (let i = 0; i < paragraph.GetElementsCount(); i += 1) {
      const element = paragraph.GetElement(i)
      if (element.GetClassType() === 'run') runs.push(element)
      if (element.GetClassType() !== 'hyperlink') continue
      for (let j = 0; j < element.GetElementsCount(); j += 1) {
        runs.push(element.GetElement(j))
      }
    }
    return runs
  }

  // The positions of the drawings of a paragraph: a position counts each
  // character and each drawing of a run, as the JSON of the run lists them
  const findDrawingPlaces = paragraph =>
    getRuns(paragraph).flatMap(run => {
      const { content } = JSON.parse(run.ToJSON())
      if (!content.some(item => item.type === 'paraDrawing')) return []
      let at = run.GetRange().GetStartPos()
      return content.flatMap(item => {
        const place = at
        at += typeof item === 'string' ? item.length : 1
        return item.type === 'paraDrawing' ? [place] : []
      })
    })

  // The drawings between two positions, in their order, with their places: a
  // drawing in a drawing goes with it. Null when one cannot be placed.
  const findSelectedDrawings = (from, to) => {
    const found = []
    for (const paragraph of paragraphs) {
      const id = paragraph.GetInternalId()
      const drawings = paragraph
        .GetAllDrawingObjects()
        .filter(drawing => drawing.GetParentParagraph()?.GetInternalId() === id)
      const places = drawings.length > 0 ? findDrawingPlaces(paragraph) : []
      if (places.length !== drawings.length) return null
      drawings.forEach((drawing, i) => {
        const place = places[i]
        if (place >= from && place < to) found.push({ drawing, place })
      })
    }
    return found
  }

  // The cells of a table, as laid on its grid: the column each one starts
  // at, the columns it takes, and whether it starts or continues a cell
  // merged with the ones above
  function readLayout(table) {
    return JSON.parse(table.ToJSON()).content.map(row => {
      let column = 0
      return row.content.map(cell => {
        const span = cell.tcPr?.gridSpan ?? 1
        const laid = { column, span, merge: cell.tcPr?.vMerge ?? null }
        column += span
        return laid
      })
    })
  }

  // The tables of the Markdown, in its order, each with the rows and cells
  // it shows: all of them for a whole table
  // The selected cells of each table, by row
  const collectSelectedCells = () => {
    const tables = new Map()
    paragraphs.forEach(paragraph => {
      const cell = paragraph.GetParentTableCell()
      if (!cell) return
      const table = cell.GetParentTable()
      const id = table.GetInternalId()
      if (!tables.has(id)) tables.set(id, { table, rows: new Map() })
      const { rows } = tables.get(id)
      const row = cell.GetRowIndex()
      if (!rows.has(row)) rows.set(row, new Set())
      rows.get(row).add(cell.GetIndex())
    })
    return tables
  }

  // Whether the cell that a cell continuing a merged one is part of is
  // selected: the first cell above it, in its column, that does not continue
  const isMergeSelected = (layout, rows, row, column) => {
    for (let above = row - 1; above >= 0; above -= 1) {
      const index = layout[above].findIndex(cell => cell.column === column)
      const isStart = index === -1 || layout[above][index].merge !== 'continue'
      if (isStart) return Boolean(rows.get(above)?.has(index))
    }
    return false
  }

  // A cell that continues a merged one has no text of its own to select:
  // the editor shows it with the cell it continues
  const addContinuedCells = ({ table, rows }) => {
    const layout = readLayout(table)
    rows.forEach((cells, row) => {
      layout[row].forEach((laid, cellIndex) => {
        if (laid.merge !== 'continue') return
        if (isMergeSelected(layout, rows, row, laid.column))
          cells.add(cellIndex)
      })
    })
  }

  function sortRows({ table, rows }) {
    return {
      table,
      rows: [...rows.keys()]
        .sort((a, b) => a - b)
        .map(row => ({ row, cells: [...rows.get(row)].sort((a, b) => a - b) }))
    }
  }

  const getTables = () => {
    if (!hasSelection) {
      return doc
        .GetAllTables()
        .filter(table => !table.GetParentTableCell())
        .map(table => ({ table, rows: null }))
    }
    const tables = collectSelectedCells()
    tables.forEach(addContinuedCells)
    return [...tables.values()].map(sortRows)
  }

  // The spans of the cells a table shows, row by row: null for a cell that
  // continues a merged one, which has no tag of its own
  const getSpans = ({ table, rows }) => {
    const layout = readLayout(table)
    // Whether a shown row continues the merged cell of a column
    const isContinuation = (cell, laid) =>
      cell.column === laid.column && cell.merge === 'continue'
    const continuesBelow = (shownRow, laid) =>
      Boolean(shownRow) &&
      layout[shownRow.row].some(cell => isContinuation(cell, laid))
    const shown =
      rows ??
      layout.map((cells, row) => ({ row, cells: cells.map((cell, i) => i) }))
    return shown.map(({ row, cells }, index) =>
      cells.map(cellIndex => {
        const laid = layout[row][cellIndex]
        if (laid.merge === 'continue') return null
        let rowSpan = 1
        while (continuesBelow(shown[index + rowSpan], laid)) rowSpan += 1
        return { colSpan: laid.span, rowSpan }
      })
    )
  }

  const CELL = /<td>([\s\S]*?)<\/td>/g
  const ROW = /<tr>([\s\S]*?)<\/tr>/g
  function describe(html, spans) {
    return [...html.matchAll(ROW)]
      .map((row, i) => {
        let j = -1
        const cells = row[1].replace(CELL, (tag, inner) => {
          j += 1
          const span = spans[i][j]
          if (!span) return ''
          const attributes =
            (span.colSpan > 1 ? ` colspan="${span.colSpan}"` : '') +
            (span.rowSpan > 1 ? ` rowspan="${span.rowSpan}"` : '')
          return `<td${attributes}>${inner}</td>`
        })
        return `<tr>${cells}</tr>`
      })
      .join('\n  ')
  }

  // A table of the Markdown is the next table of the document that has its
  // rows and cells: one the editor left out, or a table in a table, is
  // skipped
  const describeMerges = markdown => {
    const tables = getTables()
    let next = 0
    return markdown.replace(
      /<table>\n([\s\S]*?)\n<\/table>/g,
      (block, html) => {
        const rows = [...html.matchAll(ROW)].map(
          row => row[1].match(CELL)?.length ?? 0
        )
        for (; next < tables.length; next += 1) {
          const spans = getSpans(tables[next])
          const isSame =
            spans.length === rows.length &&
            spans.every((cells, i) => cells.length === rows[i])
          if (isSame) {
            next += 1
            return `<table>\n  ${describe(html, spans)}\n</table>`
          }
        }
        return block
      }
    )
  }

  // The editor opens a fence on each code paragraph, after the text of a
  // line of spaces, and closes it after the last one only:
  // "\n```\na\n\n\n```\nb\n```\n" is a block of two lines
  const joinCodeLines = markdown => {
    let isOpen = false
    return markdown.replace(
      /(\n\n([ \t]*))?\n```\n/g,
      (fence, paragraphEnd, indent, at) => {
        const isNextLine = isOpen && paragraphEnd !== undefined
        if (markdown.startsWith('```\n', at + fence.length)) {
          isOpen = false
          return isNextLine ? `\n${indent}\n` : fence
        }
        if (isNextLine) return `\n${indent}`
        isOpen = !isOpen
        return fence
      }
    )
  }

  // An answer is text: it cannot give back a chart, an equation, an endnote,
  // a field, a form, a comment or a page break, nor take the place of the end
  // of a section. It gives back a footnote, a link to a place of the document
  // and a drawing by their markers.
  const KEPT =
    /"type":"(chartSpace|paraMath|endnoteRef|fldChar|inlineLvlSdt|blockLvlSdt|commentRangeStart)"|"breakType":"(page|column)"/
  const canReplace = () => {
    const tables = new Map()
    paragraphs.forEach(paragraph => {
      const table = paragraph.GetParentTableCell()?.GetParentTable()
      if (table) tables.set(table.GetInternalId(), table)
    })
    const isCrossing =
      tables.size > 1 ||
      (tables.size === 1 &&
        paragraphs.some(paragraph => !paragraph.GetParentTableCell()))
    // Across the edge of a table, an answer is written in the cells of one
    // or two tables, not of a table in a table
    const isWritable =
      !isCrossing ||
      (tables.size <= 2 &&
        [...tables.values()].every(table => !table.GetParentTableCell()))
    // The copy of the selection leaves the ends of sections out
    const isEndingSection = paragraphs
      .slice(0, -1)
      .some(paragraph => JSON.parse(paragraph.ToJSON(false, false)).pPr?.sectPr)
    return (
      isWritable &&
      !isEndingSection &&
      !hasUnmarkedNote &&
      !hasUnmarkedDrawing &&
      !KEPT.test(selectionJson)
    )
  }

  // A part of a paragraph is a text, not the heading, the item or the quote
  // its paragraph is: the editor gives it with the mark of the paragraph,
  // which the assistant would keep, and which is not in the text. The mark of
  // an item of a sublist comes after its indent.
  const MARK = /^[ \t]*(?:#{1,6} |> ?|(?:[*+-]|\d+[.)]) )/
  const removeMark = markdown => {
    const mark = markdown.match(MARK)?.[0]
    if (!mark || paragraphs.length !== 1) return markdown
    const getText = element =>
      element.GetText({ Numbering: false }).replace(/[\r\n\t]+$/, '')
    const text = getText(selection)
    const isPart = text !== getText(paragraphs[0])
    if (!isPart || text.trimStart().startsWith(mark.trimStart())) {
      return markdown
    }
    return markdown.slice(mark.length)
  }

  // The editor's Markdown leaves the underline and the note references out:
  // each run of the selection is found in it after the run before it, out of
  // the tags and the addresses of the links, an underlined one is put between
  // <u> tags, and a note reference gives a marker
  const decorate = (selectedParagraphs, markdown) => {
    const from = selection.GetStartPos()
    const to = selection.GetEndPos()
    const parts = []
    let copied = 0
    let at = 0
    let hasParagraphText = false

    const replace = (start, end, text) => {
      parts.push(markdown.slice(copied, start), text)
      copied = end
      at = end
    }

    // The positions of a run count its characters
    const getSelectedText = run => {
      const text = run.GetText()
      const start = run.GetRange().GetStartPos()
      const clip = position =>
        Math.min(Math.max(position - start, 0), text.length)
      return text.slice(clip(from), clip(to))
    }

    // The editor gives the HTML characters of a text as entities: a < opens
    // a tag
    const ENTITIES = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    const isInTag = index => {
      const before = markdown.slice(at, index)
      return before.lastIndexOf('<') > before.lastIndexOf('>')
    }
    const find = text => {
      let index = markdown.indexOf(text, at)
      while (index !== -1 && isInTag(index)) {
        index = markdown.indexOf(text, index + 1)
      }
      return index
    }

    // Inside code the tags would be code: a block of code holds none, and a
    // code span only around all of it
    const FENCES = [...markdown.matchAll(/^[ \t]*```/gm)].map(
      match => match.index
    )
    const isInFence = index =>
      FENCES.filter(fence => fence < index).length % 2 === 1
    const isInCode = index => {
      const line = markdown.slice(markdown.lastIndexOf('\n', index) + 1, index)
      return line.split('`').length % 2 === 0
    }

    // The marks the editor writes around a text: two for bold, one for italic,
    // two for strikethrough; none in a code, which wins over them
    const countMarks = textPr =>
      (textPr.GetBold() ? 2 : 0) +
      (textPr.GetItalic() ? 1 : 0) +
      (textPr.GetStrikeout() ? 2 : 0)
    const EMPHASIS = /[*_~]/
    const WORD = /[\p{L}\p{N}]/u

    // Between a text and the marks of an emphasis that goes on past it, the
    // tags would break the marks that touch a word
    const isBreakingMarks = (start, end) => {
      let left = start
      while (left > at && EMPHASIS.test(markdown[left - 1])) left -= 1
      let right = end
      while (EMPHASIS.test(markdown[right] ?? '')) right += 1
      return (
        (left < start && WORD.test(markdown[left - 1] ?? '')) ||
        (right > end && WORD.test(markdown[right] ?? ''))
      )
    }

    // Where the tags of an underlined text go: outside of the marks of its
    // own emphasis or code, else next to it; nowhere when they would break
    // the Markdown
    const placeTags = (start, end, textPr) => {
      if (isInFence(start)) return null
      if (isInCode(start)) {
        const isWhole =
          start > at && markdown[start - 1] === '`' && markdown[end] === '`'
        return isWhole ? [start - 1, end + 1] : null
      }
      const count = countMarks(textPr)
      if (count === 0) return [start, end]
      const opening = markdown.slice(start - count, start)
      const isOwn =
        start - count >= at &&
        [...opening].every(char => EMPHASIS.test(char)) &&
        markdown.slice(end, end + count) === [...opening].reverse().join('')
      if (isOwn) return [start - count, end + count]
      return isBreakingMarks(start, end) ? null : [start, end]
    }

    // The spaces of the run go inside the tags
    const underline = ([placeStart, placeEnd], { lead, trail }) => {
      let start = placeStart
      let end = placeEnd
      if (
        start - lead.length >= at &&
        markdown.startsWith(lead, start - lead.length)
      ) {
        start -= lead.length
      }
      if (markdown.startsWith(trail, end)) end += trail.length
      replace(start, end, `<u>${markdown.slice(start, end)}</u>`)
    }

    const readRun = run => {
      const [, lead, core, trail] = getSelectedText(run)
        .replace(/[&<>"']/g, char => ENTITIES[char])
        .match(/^(\s*)([\s\S]*?)(\s*)$/)
      const index = core === '' ? -1 : find(core)
      if (index === -1) return
      hasParagraphText = true
      const textPr = run.GetTextPr()
      const place = textPr.GetUnderline()
        ? placeTags(index, index + core.length, textPr)
        : null
      if (!place) {
        at = index + core.length
        return
      }
      underline(place, { lead, trail })
    }

    // The plain text of the first paragraph of a note, from the JSON of the
    // run of its reference
    const readNoteText = footnote => {
      const readText = element =>
        (element.content ?? [])
          .map(item => {
            if (typeof item === 'string') return item
            if (['tab', 'break'].includes(item.type)) return ' '
            return ['run', 'hyperlink'].includes(item.type)
              ? readText(item)
              : ''
          })
          .join('')
      const [first] = footnote.content
      return first ? readText(first).trim() : ''
    }

    // A note is given after the text before its reference, out of a link,
    // and after the mark of its paragraph when it comes first there. A
    // marker would be text in a code, and an answer writes no note in a cell:
    // a note there gives none.
    const hasNotes = NOTE_REFERENCE.test(selectionJson)
    const PARAGRAPH_START = /[*_~]*\s*(?:#{1,6} |> ?|(?:[*+-]|\d+[.)]) )?/y
    const findNotePoint = () => {
      if (hasParagraphText) return at
      PARAGRAPH_START.lastIndex = at
      PARAGRAPH_START.test(markdown)
      return PARAGRAPH_START.lastIndex
    }
    const addNoteMarkers = (run, paragraph) => {
      const range = run.GetRange()
      if (range.GetStartPos() >= to || range.GetEndPos() <= from) return
      const json = run.ToJSON()
      if (!NOTE_REFERENCE.test(json)) return
      const point = findNotePoint()
      if (
        paragraph.GetParentTableCell() ||
        isInFence(point) ||
        isInCode(point)
      ) {
        hasUnmarkedNote = true
        return
      }
      JSON.parse(json).footnotes.forEach(footnote => {
        notes.push(readNoteText(footnote))
        replace(point, point, `[^scribe-fn-${notes.length}]`)
      })
    }

    // The builder lists no bookmark whose name starts with `_`, as the one
    // Word and the editor put on a heading a link goes to: the JSON of the
    // headings has them. A link whose bookmark is gone goes to the heading.
    let headingBookmarks = null
    const readBookmarks = paragraph =>
      JSON.parse(paragraph.ToJSON(false, false))
        .content.filter(element => element.type === 'bookmarkStart')
        .map(element => element.name)
    const getRefKind = anchor => {
      if (!anchor.startsWith('_')) return 'bookmark'
      if (!headingBookmarks) {
        headingBookmarks = new Set(
          doc.GetAllHeadingParagraphs().flatMap(readBookmarks)
        )
      }
      return headingBookmarks.has(anchor) ? 'bookmark' : 'heading'
    }

    // The editor gives a link to a place of the document, which has no
    // address, as `[text]()` with its text as it is (`[1]` gives `[[1]]()`),
    // and the part of it a selection cuts as plain text. A `}` would end the
    // marker; in a cell or a code the link stays, and an answer gives back
    // its text. The marks of an emphasis of the whole text go around the
    // marker.
    const REF_LINK_END = ']()'
    const LINK_MARKS = /[*_~`\\]/g
    const EDGE_MARKS = /^([*_~]*)[\s\S]*?([*_~]*)$/
    const isSameText = (a, b) =>
      a.replace(LINK_MARKS, '').trim() === b.replace(LINK_MARKS, '').trim()
    const wrapInMarks = (marker, linkText, text) => {
      const [, open, close] = linkText.match(EDGE_MARKS)
      const isWrapped =
        open !== '' &&
        open === [...close].reverse().join('') &&
        !text.trimStart().startsWith(open)
      return isWrapped ? `${open}${marker}${close}` : marker
    }
    const addRefMarker = (hyperlink, runs, paragraph) => {
      if (hyperlink.GetLinkedText() || paragraph.GetParentTableCell()) {
        return false
      }
      const { anchor } = JSON.parse(hyperlink.ToJSON())
      const text = runs
        .map(getSelectedText)
        .join('')
        .replace(/[&<>"']/g, char => ENTITIES[char])
      const start = markdown.indexOf('[', at)
      const end = start === -1 ? -1 : markdown.indexOf(REF_LINK_END, start)
      const linkText = markdown.slice(start + 1, end)
      const isMarked =
        Boolean(anchor) &&
        end !== -1 &&
        text.trim() !== '' &&
        !text.includes('}') &&
        isSameText(linkText, text) &&
        !isInFence(start) &&
        !isInCode(start)
      if (!isMarked) return false
      refs.push({ anchor, kind: getRefKind(anchor) })
      hasParagraphText = true
      const marker = `{{REF:scribe-ref-${refs.length}:${text}}}`
      replace(
        start,
        end + REF_LINK_END.length,
        wrapInMarks(marker, linkText, text)
      )
      return true
    }

    // A drawing the editor's Markdown does not give is given after the text
    // before it, out of a code
    const addDrawingMarkers = run => {
      if (unlisted.length === 0) return
      const range = run.GetRange()
      const isInRun = ({ place }) =>
        place >= range?.GetStartPos() && place < range?.GetEndPos()
      unlisted.filter(isInRun).forEach(({ number }) => {
        const point = findNotePoint()
        if (isInFence(point) || isInCode(point)) {
          hasUnmarkedDrawing = true
          return
        }
        const space = /\S/.test(markdown[point - 1] ?? '') ? ' ' : ''
        replace(point, point, `${space}![image ${number}]`)
      })
    }

    const LINK_END = /[*_~`]*\]\([^)]*\)/y
    selectedParagraphs.forEach(paragraph => {
      hasParagraphText = false
      const addMarkers = run => {
        if (hasNotes) addNoteMarkers(run, paragraph)
        addDrawingMarkers(run)
      }
      for (let i = 0; i < paragraph.GetElementsCount(); i += 1) {
        const element = paragraph.GetElement(i)
        if (element.GetClassType() === 'run') {
          readRun(element)
          addMarkers(element)
        }
        if (element.GetClassType() !== 'hyperlink') continue
        const runs = []
        for (let j = 0; j < element.GetElementsCount(); j += 1) {
          runs.push(element.GetElement(j))
        }
        if (!addRefMarker(element, runs, paragraph)) {
          runs.forEach(readRun)
          LINK_END.lastIndex = at
          if (LINK_END.test(markdown)) at = LINK_END.lastIndex
        }
        runs.forEach(addMarkers)
      }
    })
    parts.push(markdown.slice(copied))
    return parts.join('')
  }

  // The editor's Markdown gives each picture as `![](its address)`, in the
  // order of the drawings, and no other drawing, as a shape. The drawings are
  // numbered when the pictures are all there.
  const PICTURE = /!\[\]\([^)]*\)/g
  const markdown = joinCodeLines(doc.ToMarkdown())
  const drawings =
    paragraphs.length > 0
      ? findSelectedDrawings(selection.GetStartPos(), selection.GetEndPos())
      : []
  const isPicture = ({ drawing }) => drawing.GetClassType() === 'image'
  const isNumbered =
    drawings !== null &&
    drawings.filter(isPicture).length === (markdown.match(PICTURE)?.length ?? 0)
  const numbered = isNumbered
    ? drawings.map((found, index) => ({ ...found, number: index + 1 }))
    : []
  const pictureNumbers = numbered.filter(isPicture).map(({ number }) => number)
  const unlisted = numbered.filter(found => !isPicture(found))
  hasUnmarkedDrawing =
    paragraphs.length > 0 &&
    (drawings === null || (!isNumbered && drawings.length > 0))
  // A marker would be text in a code
  const isInCodeText = (text, index) => {
    const fences = text.slice(0, index).match(/^[ \t]*```/gm)?.length ?? 0
    const line = text.slice(text.lastIndexOf('\n', index) + 1, index)
    return fences % 2 === 1 || line.split('`').length % 2 === 0
  }
  const numberPictures = text => {
    let next = 0
    return text.replace(PICTURE, (picture, index) => {
      const number = pictureNumbers[next]
      next += 1
      if (!number) return '[image]'
      if (!isInCodeText(text, index)) return `![image ${number}]`
      hasUnmarkedDrawing = true
      return '[image]'
    })
  }

  const decorated = describeMerges(
    hasSelection ? decorate(paragraphs, markdown) : markdown
  )
  const content = numberPictures(
    hasSelection ? removeMark(decorated) : decorated
  )
  return {
    content,
    target: hasSelection ? 'selection' : 'document',
    canReplace: hasSelection && !isLocked && canReplace(),
    notes,
    refs,
    imageCount: numbered.length
  }
}

/**
 * Reads the whole document as `readContent` reads it without a selection:
 * its Markdown, a picture as `[image]`, and no marker. The editor gives the
 * Markdown of the selection when there is one: the selection is put away,
 * then selected again, at the positions it had in the document.
 *
 * @param {Function} readWhole - `readContent`, which the command gives:
 * nothing defined outside of this function can be called from it
 * @returns {string} the text, in Markdown
 */
export function readDocument(readWhole) {
  const doc = Api.GetDocument()
  const selection = doc.GetRangeBySelect()
  const isSelected =
    Boolean(selection) && selection.GetStartPos() < selection.GetEndPos()
  // An image selected by a click has no range of text: it is selected again
  // by itself
  const drawings = selection ? [] : doc.GetSelectedDrawings()
  // A cursor in the text of a shape has a range that is not the cursor:
  // nothing is removed, the editor converts no selection for it
  const isInShape =
    Boolean(selection) && !isSelected && doc.GetSelectedDrawings().length > 0
  if (isSelected) doc.RemoveSelection()
  try {
    return readWhole(isInShape).content
  } finally {
    if (isSelected) selection.Select()
    drawings.forEach(drawing => drawing.Select())
  }
}

/**
 * Writes the blocks of an answer in the document, with the styles of the
 * document: in place of the selection (`Asc.scope.isReplace`), or else at its
 * end or at the cursor: in the line when that is inside a text, after the
 * paragraph otherwise. The new text is left selected: the user sees it, and
 * the next answer can replace it. The marker of an image, `![image K]`, is a
 * copy of the drawing of the selection it names: the K-th one, when the
 * selection holds as many drawings as the text read gave markers
 * (`Asc.scope.imageCount`), or, over an answer written for the same text, the
 * copy written for K (`Asc.scope.writtenImages`, the markers its drawings
 * were copies for).
 *
 * @returns {{ written: boolean, skippedCells: number, images: number[] }}
 * whether the answer was written, not when there was nowhere to write, the
 * count of the selected cells the answer had no cell for, and the marker each
 * drawing of the answer left selected is a copy for, null when not known
 */
export function writeBlocks() {
  const {
    notes = [],
    refs = [],
    imageCount = 0,
    writtenImages = null
  } = Asc.scope
  // An image block is a paragraph of its image
  const blocks = Asc.scope.blocks.map(block =>
    block.type === 'image'
      ? { ...block, spans: [{ image: block.image }] }
      : block
  )
  const doc = Api.GetDocument()
  function getText(element) {
    return element.GetText({ Numbering: false, ParaSeparator: '\n' })
  }
  // A cursor is no selection: once the document has been read, the editor
  // gives for it an empty range in the first cell of its table
  const range = doc.GetRangeBySelect()
  let selection =
    range && range.GetStartPos() < range.GetEndPos() ? range : null
  let paragraphs = selection?.GetAllParagraphs() ?? []

  // The runs of a paragraph, those of its links included
  const getRuns = paragraph => {
    const runs = []
    for (let i = 0; i < paragraph.GetElementsCount(); i += 1) {
      const element = paragraph.GetElement(i)
      if (element.GetClassType() === 'run') runs.push(element)
      if (element.GetClassType() !== 'hyperlink') continue
      for (let j = 0; j < element.GetElementsCount(); j += 1) {
        runs.push(element.GetElement(j))
      }
    }
    return runs
  }

  // The drawings of a range, in their order, with their places, as
  // `readContent` numbers them: a position counts each character and each
  // drawing of a run
  const findDrawingPlaces = paragraph =>
    getRuns(paragraph).flatMap(run => {
      const { content } = JSON.parse(run.ToJSON())
      if (!content.some(item => item.type === 'paraDrawing')) return []
      let at = run.GetRange().GetStartPos()
      return content.flatMap(item => {
        const place = at
        at += typeof item === 'string' ? item.length : 1
        return item.type === 'paraDrawing' ? [place] : []
      })
    })
  const findDrawings = selected => {
    if (!selected || selected.GetStartPos() >= selected.GetEndPos()) return []
    const from = selected.GetStartPos()
    const to = selected.GetEndPos()
    const found = []
    for (const paragraph of selected.GetAllParagraphs() ?? []) {
      const id = paragraph.GetInternalId()
      const drawings = paragraph
        .GetAllDrawingObjects()
        .filter(drawing => drawing.GetParentParagraph()?.GetInternalId() === id)
      const places = drawings.length > 0 ? findDrawingPlaces(paragraph) : []
      if (places.length !== drawings.length) return []
      drawings.forEach((drawing, i) => {
        const place = places[i]
        if (place >= from && place < to) found.push({ drawing, place })
      })
    }
    return found
  }

  // Read before anything changes. A selection that does not hold as many
  // drawings as its markers name, as after an undo, may not hold the ones
  // they name: each image is then written as its text.
  const drawings = findDrawings(selection).map(({ drawing }) => drawing)
  const findOriginal = number => {
    if (writtenImages?.length === drawings.length) {
      return drawings[writtenImages.indexOf(number)] ?? null
    }
    if (drawings.length !== imageCount) return null
    return drawings[number - 1] ?? null
  }
  // The blocks in the order of the document once written
  let writtenBlocks = blocks
  // A copy keeps the wrapping of a floating drawing, and takes the
  // alternative text, the name and the link of the original
  const copyOf = number => {
    const original = findOriginal(number)
    const copy = original?.Copy() ?? null
    copy?.SetDrawingPrFromDrawing(original)
    return copy
  }
  // The editor writes a table in a table over its cells: a table of the
  // answer goes under the table of the selection, out of any other one
  const hasTable = blocks.some(block => block.type === 'table')
  // A selection across the edge of a table: a text and cells, or the cells
  // of two tables
  const tableIds = new Set(
    paragraphs
      .map(paragraph => paragraph.GetParentTableCell()?.GetParentTable())
      .filter(Boolean)
      .map(table => table.GetInternalId())
  )
  const isCrossing =
    tableIds.size > 1 ||
    (tableIds.size === 1 &&
      paragraphs.some(paragraph => !paragraph.GetParentTableCell()))
  // Across it, an answer takes the place of the selection when it mirrors
  // its shape, with a table: another one, as a summary, is inserted
  const isReplace = Asc.scope.isReplace && (hasTable || !isCrossing)
  const findOuterTable = table => {
    let outer = table
    while (outer.GetParentTableCell()) {
      outer = outer.GetParentTableCell().GetParentTable()
    }
    return outer
  }
  // The look of the new text, once its place is known
  let textPr = null
  const numberings = {}
  let lastWritten = null
  let skippedCells = 0

  // The look of most of the text of a paragraph: a word set apart, as a word
  // in italics or a link, does not give its look to a new paragraph
  const findMainLook = paragraph => {
    let found = null
    for (let i = 0; i < (paragraph?.GetElementsCount() ?? 0); i += 1) {
      const element = paragraph.GetElement(i)
      if (element.GetClassType() !== 'run') continue
      // The empty run of an empty paragraph holds the look the user chose
      if (!found || element.GetText().length > found.GetText().length) {
        found = element
      }
    }
    return found?.GetTextPr() ?? null
  }

  // A text written in place of a selected one has the look of its first
  // character, as a text typed over it
  const findStartLook = (paragraph, start) => {
    for (let i = 0; i < paragraph.GetElementsCount(); i += 1) {
      const element = paragraph.GetElement(i)
      const isText =
        element.GetClassType() === 'run' && element.GetText() !== ''
      if (isText && element.GetRange().GetEndPos() > start) {
        return element.GetTextPr()
      }
    }
    return findMainLook(paragraph)
  }

  // A reference the text read did not give stays plain text
  const isKnownRef = span =>
    span.ref !== undefined && typeof refs[span.ref - 1]?.anchor === 'string'

  // A note takes the place of its placeholder once the answer is written:
  // the editor adds a note at the cursor only. The text of a reference,
  // between its placeholders, then becomes a link.
  const makeRunText = span => {
    if (span.image !== undefined) return '[image]'
    if (span.note !== undefined) return `\u0000fn:${span.note}\u0000`
    if (!isKnownRef(span)) return span.text
    return `\u0000ref:${span.ref}\u0000${span.text}\u0000/ref\u0000`
  }

  const makeRun = (span, textPr) => {
    const run = Api.CreateRun()
    if (textPr) run.SetTextPr(textPr)
    const copy = span.image === undefined ? null : copyOf(span.image)
    if (copy) run.AddDrawing(copy)
    else run.AddText(makeRunText(span))
    // The emphasis is the one of the answer, over the one of the style
    run.SetBold(span.isBold ? true : undefined)
    run.SetItalic(span.isItalic ? true : undefined)
    run.SetStrikeout(span.isStrike ? true : undefined)
    run.SetUnderline(span.isUnderline ? true : undefined)
    if (span.isCode) run.SetFontFamily('Courier New')
    return run
  }

  // A link has no underline of its own: its runs have
  const makeHyperlink = span => {
    const hyperlink = Api.CreateHyperlink(span.href, span.text)
    if (!span.isUnderline) return hyperlink
    for (let i = 0; i < hyperlink.GetElementsCount(); i += 1) {
      hyperlink.GetElement(i).SetUnderline(true)
    }
    return hyperlink
  }

  // A marker the text read did not give has no note: a placeholder written
  // for it would stay in the text where the answer is not left selected
  const isUnknownNote = span =>
    span.note !== undefined && typeof notes[span.note - 1] !== 'string'

  const addSpans = (paragraph, spans, textPr) => {
    spans.forEach(span => {
      if (isUnknownNote(span)) return
      if (span.isBreak) {
        paragraph.AddLineBreak()
        return
      }
      const element = span.href ? makeHyperlink(span) : makeRun(span, textPr)
      paragraph.AddElement(element)
      lastWritten = element
    })
  }

  const makeParagraph = (spans, styleName, textPr) => {
    const paragraph = Api.CreateParagraph()
    const style = styleName ? doc.GetStyle(styleName) : null
    if (style) paragraph.SetStyle(style)
    addSpans(paragraph, spans, textPr)
    return paragraph
  }

  // Items written in place of items of a list stay in that list, at the
  // level of the first one and under it
  let hostItem = null
  const makeListItem = block => {
    if (hostItem) {
      const paragraph = makeParagraph(block.spans, null, textPr)
      const style = hostItem.GetStyle()
      if (style) paragraph.SetStyle(style)
      const level = hostItem.GetNumbering()
      const depth = Math.min(level.GetLevelIndex() + block.depth, 8)
      paragraph.SetNumbering(level.GetNumbering().GetLevel(depth))
      return paragraph
    }
    const paragraph = makeParagraph(block.spans, 'List Paragraph', textPr)
    if (!numberings[block.listId]) {
      numberings[block.listId] = doc.CreateNumbering(
        block.isOrdered ? 'numbered' : 'bullet'
      )
    }
    paragraph.SetNumbering(numberings[block.listId].GetLevel(block.depth))
    return paragraph
  }

  // Lays the cells of a table on its grid: each one takes the first free
  // column of its row, then the columns and rows it spans
  const layCells = rows => {
    const taken = new Set()
    const cells = []
    rows.forEach((row, rowIndex) => {
      let column = 0
      row.forEach(cell => {
        while (taken.has(`${rowIndex},${column}`)) column += 1
        const colSpan = cell.colSpan ?? 1
        const rowSpan = cell.rowSpan ?? 1
        for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
          for (let c = column; c < column + colSpan; c += 1) {
            taken.add(`${r},${c}`)
          }
        }
        cells.push({
          row: rowIndex,
          column,
          colSpan,
          rowSpan,
          spans: cell.spans,
          blocks: cell.blocks
        })
        column += colSpan
      })
    })
    return cells
  }

  const makeMarkerText = ({ note, ref, ...span }) => {
    if (note !== undefined) return { text: `[^scribe-fn-${note}]` }
    if (ref === undefined) return span
    return { ...span, text: `{{REF:scribe-ref-${ref}:${span.text}}}` }
  }

  // The spans of each paragraph a cell of an answer is written in: a heading
  // or an item of a list is a plain paragraph in a cell, and the marker of a
  // note or of a reference stays text
  const getCellParagraphs = answerCell =>
    (answerCell.blocks ?? [answerCell]).map(block =>
      block.spans.map(makeMarkerText)
    )

  // The first paragraph of a cell takes the first spans, and empty copies of
  // it, which keep its look, the next ones
  const writeCellParagraphs = (content, paragraphSpans, textPr) => {
    const paragraph = content.GetElement(0)
    const paragraphs = paragraphSpans.map((spans, index) =>
      index === 0 ? paragraph : paragraph.Copy()
    )
    paragraphs.forEach((written, index) => {
      if (index > 0) content.AddElement(index, written)
      addSpans(written, paragraphSpans[index], textPr)
    })
  }

  const makeTable = rows => {
    const cells = layCells(rows)
    const rowCount = Math.max(...cells.map(cell => cell.row + cell.rowSpan))
    const columnCount = Math.max(
      ...cells.map(cell => cell.column + cell.colSpan)
    )
    // The editor takes the rows first since its version 9.4, the columns
    // first before
    const table = [
      Api.CreateTable(rowCount, columnCount),
      Api.CreateTable(columnCount, rowCount)
    ].find(created => created.GetRowsCount() === rowCount)
    table.SetWidth('percent', 100)
    const sides = ['Top', 'Bottom', 'Left', 'Right', 'InsideH', 'InsideV']
    sides.forEach(side => {
      table[`SetTableBorder${side}`]('single', 4, 0, 0, 0, 0)
    })
    cells.forEach(cell => {
      const content = table.GetCell(cell.row, cell.column).GetContent()
      writeCellParagraphs(content, getCellParagraphs(cell), textPr)
    })
    // A merge takes the cells on its right in its rows: the rightmost ones
    // are merged first, while their cells are still where they were laid
    cells
      .filter(cell => cell.colSpan > 1 || cell.rowSpan > 1)
      .sort((a, b) => b.column - a.column)
      .forEach(cell => {
        const merged = []
        for (let r = cell.row; r < cell.row + cell.rowSpan; r += 1) {
          for (let c = cell.column; c < cell.column + cell.colSpan; c += 1) {
            merged.push(table.GetCell(r, c))
          }
        }
        table.MergeCells(merged)
      })
    return table
  }

  // A line of code is a paragraph of its own, light on a dark shading: of
  // the look of the text around it, it takes the size only
  const makeCodeParagraphs = block => {
    const codePr = Api.CreateTextPr()
    codePr.SetColor(212, 212, 212)
    const size = textPr?.GetFontSize()
    if (size) codePr.SetFontSize(size)
    return block.lines.map(line => {
      const paragraph = makeParagraph(
        [{ text: line, isCode: true }],
        null,
        codePr
      )
      paragraph.SetShd('clear', 40, 44, 52)
      paragraph.SetSpacingBefore(0)
      paragraph.SetSpacingAfter(0)
      return paragraph
    })
  }

  // The elements of a block: several paragraphs for a block of code
  const makeElement = block => {
    // A heading has the look of its style only
    if (block.type === 'heading') {
      return makeParagraph(block.spans, `Heading ${block.level}`, null)
    }
    if (block.type === 'quote') {
      return makeParagraph(block.spans, 'Quote', textPr)
    }
    if (block.type === 'listItem') return makeListItem(block)
    if (block.type === 'table') return makeTable(block.rows)
    if (block.type === 'code') return makeCodeParagraphs(block)
    return makeParagraph(block.spans, null, textPr)
  }

  // Cells by row, each row with its cells in order
  function groupByRow(cells) {
    const rows = new Map()
    cells.forEach(cell => {
      if (!rows.has(cell.GetRowIndex())) rows.set(cell.GetRowIndex(), [])
      rows.get(cell.GetRowIndex()).push(cell)
    })
    return [...rows.keys()]
      .sort((a, b) => a - b)
      .map(row => rows.get(row).sort((a, b) => a.GetIndex() - b.GetIndex()))
  }

  // The cells the selection takes, when it takes several cells of one table:
  // their rows, each with its cells in order
  const getSelectedCells = () => {
    // A text around the cells makes it a selection of text and table
    if (paragraphs.some(paragraph => !paragraph.GetParentTableCell())) {
      return null
    }
    const tables = new Map()
    paragraphs.forEach(paragraph => {
      const cell = paragraph.GetParentTableCell()
      const table = cell.GetParentTable()
      if (!tables.has(table.GetInternalId())) {
        tables.set(table.GetInternalId(), { table, cells: new Map() })
      }
      tables.get(table.GetInternalId()).cells.set(cell.GetInternalId(), cell)
    })
    if (tables.size !== 1) return null
    const [{ table, cells }] = tables.values()
    if (cells.size < 2) return null
    return { table, rows: groupByRow(cells) }
  }

  // Writes the text of an answer in a cell, in the look of its text, with
  // the emphasis of the answer added: a cell the answer has none for is
  // emptied
  const fillCell = (cell, answerCell = { spans: [] }) => {
    const content = cell.GetContent()
    const paragraph = content.GetElement(0)
    const first = paragraph.GetElement(0)
    const textPr = first?.GetClassType() === 'run' ? first.GetTextPr() : null
    for (let i = content.GetElementsCount() - 1; i > 0; i -= 1) {
      content.RemoveElement(i)
    }
    paragraph.RemoveAllElements()
    const keepLook = span => ({
      ...span,
      isBold: span.isBold || textPr?.GetBold() === true,
      isItalic: span.isItalic || textPr?.GetItalic() === true,
      isUnderline: span.isUnderline || textPr?.GetUnderline() === true
    })
    const paragraphSpans = getCellParagraphs(answerCell).map(spans =>
      spans.map(keepLook)
    )
    writeCellParagraphs(content, paragraphSpans, textPr)
  }

  // The cells of a table that are not merged into one above them
  function countCells(table) {
    return JSON.parse(table.ToJSON()).content.reduce(
      (count, row) =>
        count +
        row.content.filter(cell => cell.tcPr?.vMerge !== 'continue').length,
      0
    )
  }

  function countSelected(rows) {
    return rows.reduce((sum, row) => sum + row.length, 0)
  }

  function hasSameShape(selectedCells, table) {
    return (
      table.rows.length === selectedCells.rows.length &&
      table.rows.every((row, i) => row.length === selectedCells.rows[i].length)
    )
  }

  // Writes a table in the selected cells of the same shape, and selects the
  // table when they are all of its cells
  const fillCells = (selectedCells, table) => {
    selectedCells.rows.forEach((cells, i) => {
      cells.forEach((cell, j) => fillCell(cell, table.rows[i][j]))
    })
    const cellCount = countSelected(selectedCells.rows)
    if (cellCount === countCells(selectedCells.table)) {
      selectedCells.table.Select()
    }
  }

  // Rows and columns are added and removed through one of their cells: a
  // merged cell would be cut, a table in that cell would take the change,
  // and in rows of different lengths the cells of an index are not a column.
  // The editor marks the cells of a row it adds as starting a merge: a merge
  // is told by the cells that continue it.
  function canReshape(table) {
    const isRegular = JSON.parse(table.ToJSON()).content.every(
      ({ trPr, content }) =>
        !trPr?.gridBefore &&
        !trPr?.gridAfter &&
        content.every(
          cell =>
            cell.tcPr?.vMerge !== 'continue' && (cell.tcPr?.gridSpan ?? 1) === 1
        )
    )
    return isRegular && table.GetTables().length === 0
  }

  function hasSpans(answerTable) {
    return answerTable.rows.some(row =>
      row.some(cell => (cell.colSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1)
    )
  }

  // Added rows and columns take the look of the last ones
  const shapeCopy = (copy, answerTable) => {
    const rowCount = answerTable.rows.length
    const columnCount = Math.max(...answerTable.rows.map(row => row.length))
    const copyRows = copy.GetRowsCount()
    const copyColumns = copy.GetRow(0).GetCellsCount()
    for (let r = copyRows - 1; r >= rowCount; r -= 1) {
      copy.RemoveRow(copy.GetCell(r, 0))
    }
    if (copyRows < rowCount) {
      copy.AddRows(copy.GetCell(copyRows - 1, 0), rowCount - copyRows)
    }
    for (let c = copyColumns - 1; c >= columnCount; c -= 1) {
      copy.RemoveColumn(copy.GetCell(0, c))
    }
    if (copyColumns < columnCount) {
      const last = copy.GetCell(0, copyColumns - 1)
      copy.AddColumns(last, columnCount - copyColumns)
    }
    for (let r = 0; r < rowCount; r += 1) {
      for (let c = 0; c < columnCount; c += 1) {
        fillCell(copy.GetCell(r, c), answerTable.rows[r][c])
      }
    }
    return copy
  }

  // A copy of the table of the selected cells, which keeps its borders,
  // widths and fonts, with the cells of an answer in place of the selected
  // ones. Cut down to the selected rows and columns, it takes the shape of
  // the answer; a table that cannot be cut stays whole, for an answer of the
  // shape of the cells only.
  const makeTableCopy = ({ table, rows }, answerTable, isReshapable) => {
    if (!isReshapable) {
      if (!hasSameShape({ rows }, answerTable)) return null
      const copy = table.Copy()
      rows.forEach((cells, i) => {
        cells.forEach((cell, j) => {
          const copied = copy.GetCell(cell.GetRowIndex(), cell.GetIndex())
          fillCell(copied, answerTable.rows[i][j])
        })
      })
      return copy
    }
    if (hasSpans(answerTable)) return null
    const copy = table.Copy()
    const selectedRows = rows.map(cells => cells[0].GetRowIndex())
    const selectedColumns = rows[0].map(cell => cell.GetIndex())
    for (let r = copy.GetRowsCount() - 1; r >= 0; r -= 1) {
      if (!selectedRows.includes(r)) copy.RemoveRow(copy.GetCell(r, 0))
    }
    for (let c = copy.GetRow(0).GetCellsCount() - 1; c >= 0; c -= 1) {
      if (!selectedColumns.includes(c)) copy.RemoveColumn(copy.GetCell(0, c))
    }
    return shapeCopy(copy, answerTable)
  }

  // A whole table replaced by a table of another shape: a copy of it in that
  // shape keeps its look
  const reshapeTable = (table, answerTable, isReshapable) =>
    isReshapable && !hasSpans(answerTable)
      ? shapeCopy(table.Copy(), answerTable)
      : null

  // The text of the selected paragraphs before and after the selection
  const getAround = () => {
    const first = paragraphs[0].GetRange().GetStartPos()
    const last = paragraphs[paragraphs.length - 1].GetRange().GetEndPos()
    const getPart = (from, to) =>
      getText(doc.GetRange(from, to)).replace(/[\n\t]+$/, '')
    return {
      before: getPart(first, selection.GetStartPos()),
      after: getPart(selection.GetEndPos(), last)
    }
  }

  // A selection from the end of a line holds nothing of its paragraph but
  // the mark: the answer starts in the next paragraph, and the one above
  // keeps its text and its style
  const skipEndOfLine = () => {
    const [first, next] = paragraphs
    const part = doc.GetRange(
      selection.GetStartPos(),
      first.GetRange().GetEndPos()
    )
    const isEndOfLine =
      getText(part).trim() === '' && getText(first).trim() !== ''
    if (!next || !isEndOfLine) return
    paragraphs.shift()
    selection.SetStartPos(next.GetRange().GetStartPos())
  }

  // A selection to the start of a line of text, as Shift+Down makes it,
  // holds nothing of it: the answer goes under the paragraph above
  const skipStartOfLine = () => {
    const last = paragraphs[paragraphs.length - 1]
    const previous = paragraphs[paragraphs.length - 2]
    if (!previous || getText(last).trim() === '') return
    if (selection.GetEndPos() > last.GetRange().GetStartPos()) return
    paragraphs.pop()
    selection.SetEndPos(previous.GetRange().GetEndPos())
  }

  // Moves an end of a range over what the answer does not replace
  const shrinkRange = (range, isStart, isOut) => {
    let start = range.GetStartPos()
    let end = range.GetEndPos()
    while (end > start && isOut(getText(range))) {
      if (isStart) range.SetStartPos((start += 1))
      else range.SetEndPos((end -= 1))
    }
  }

  // The answer takes the place of the text, in the paragraphs that hold it:
  // the mark that ends the last one is kept, and the spaces around a part of
  // a paragraph, which the answer of the LLM never has
  const fitSelection = isWhole => {
    shrinkRange(selection, false, text => text.endsWith('\n'))
    if (!isWhole) {
      shrinkRange(selection, true, text => /^\s/.test(text))
      shrinkRange(selection, false, text => /\s$/.test(text))
    }
    selection.Select()
  }

  // A whole table replaced by an answer that does not fill it goes away: the
  // answer takes its place, unless a table of the answer would then be in a
  // table
  const isReplacingTable = ({ table, rows }) =>
    isReplace &&
    countSelected(rows) === countCells(table) &&
    (!hasTable || !table.GetParentTableCell())

  // An answer to the cells of a table goes under the table, or in place of
  // the whole table it replaces
  const placeAfterTable = (placeholder, selectedTable, isWhole) => {
    const table = hasTable ? findOuterTable(selectedTable) : selectedTable
    const parent = table.GetParentTableCell()?.GetContent() ?? doc
    let index = table.GetPosInParent() + 1
    if (isWhole) {
      index -= 1
      table.Delete()
    }
    parent.AddElement(index, placeholder)
  }

  // What the answer goes under: the last paragraph of the selection, or the
  // one of the cursor, or the table of its last cell when the selection is
  // not in that cell only, or when the answer has a table
  const findAnchor = () => {
    const last = paragraphs[paragraphs.length - 1] ?? doc.GetCurrentParagraph()
    const cell = last?.GetParentTableCell()
    if (cell && hasTable) return findOuterTable(cell.GetParentTable())
    const cells = new Set(
      paragraphs.map(
        paragraph => paragraph.GetParentTableCell()?.GetInternalId() ?? null
      )
    )
    return cell && cells.size > 1 ? cell.GetParentTable() : last
  }

  // The editor gives no range at a cursor, but the parts of its sentence
  // before and after it: the cursor is where they meet, in its run. It gives
  // no sentence that holds an image or a field, and a tab in it as a space.
  const findCursorRange = paragraph => {
    const current = doc.GetCurrentRun()
    const before = doc.GetCurrentSentence('before')
    const after = doc.GetCurrentSentence('after')
    const isRead = typeof before === 'string' && typeof after === 'string'
    if (!current || !isRead || (before === '' && after === '')) return null
    const runs = getRuns(paragraph)
    const getRunText = run => run.GetText({ TabSymbol: ' ' })
    const text = runs.map(getRunText).join('')
    const start = current.GetRange().GetStartPos()
    // A sentence met twice in the run leaves the cursor unknown
    const found = new Map()
    let offset = 0
    runs.forEach(run => {
      const { length } = getRunText(run)
      const isCurrent = run.GetRange().GetStartPos() === start
      for (let k = 0; isCurrent && k <= length; k += 1) {
        const at = offset + k
        if (text.endsWith(before, at) && text.startsWith(after, at)) {
          found.set(at, run.GetRange(k, k))
        }
      }
      offset += length
    })
    return found.size === 1 ? [...found.values()][0] : null
  }

  // Where an answer is inserted in the line of a text: at the end of the
  // selection, or at the cursor, with the text of its paragraph on each side.
  // At the end of a paragraph, in an empty one, after cells, or for an answer
  // with a table, as a caption and its table, it is written in new
  // paragraphs.
  const findCursor = () => {
    if (hasTable) return null
    const paragraph = findAnchor()
    if (paragraph?.GetClassType() !== 'paragraph') return null
    const range = selection
      ? doc.GetRange(selection.GetEndPos(), selection.GetEndPos())
      : findCursorRange(paragraph)
    if (!range) return null
    const point = range.GetStartPos()
    const whole = paragraph.GetRange()
    const after = getText(doc.GetRange(point, whole.GetEndPos())).replace(
      /[\n\t]+$/,
      ''
    )
    if (after.trim() === '') return null
    const before = getText(doc.GetRange(whole.GetStartPos(), point))
    return { paragraph, range, before, after }
  }

  // An empty paragraph has no text, and nothing but runs: not an image, a
  // page break, a field or a form, nor the end of a section. The look of its
  // runs, as a color of the theme, does not count.
  const isEmpty = paragraph => {
    if (getText(paragraph).trim() !== '') return false
    const { pPr, content } = JSON.parse(paragraph.ToJSON(false, false))
    return (
      !pPr?.sectPr &&
      content.every(
        element =>
          ['run', 'endRun'].includes(element.type) &&
          element.content.every(item => typeof item === 'string')
      )
    )
  }

  // Whether an empty paragraph holds a table of the answer apart from a
  // table of the document beside it, which it would join
  const isBetweenTables = paragraph => {
    const parent = paragraph.GetParentTableCell()?.GetContent() ?? doc
    const index = paragraph.GetPosInParent()
    const isTable = (block, at) =>
      block.type === 'table' &&
      parent.GetElement(at)?.GetClassType() === 'table'
    return (
      isTable(blocks[0], index - 1) ||
      isTable(blocks[blocks.length - 1], index + 1)
    )
  }

  // Selects where the answer goes: a new paragraph after its anchor, or the
  // anchor itself when it is an empty paragraph, as the one of an empty
  // document
  const selectPlaceholder = () => {
    const placeholder = Api.CreateParagraph()
    const anchor = findAnchor()
    if (!anchor) return false
    if (anchor.GetClassType() === 'table') {
      const parent = anchor.GetParentTableCell()?.GetContent() ?? doc
      parent.AddElement(anchor.GetPosInParent() + 1, placeholder)
      placeholder.Select()
      return true
    }
    textPr = findMainLook(anchor)
    if (isEmpty(anchor) && !isBetweenTables(anchor)) {
      anchor.Select()
      return true
    }
    anchor.InsertParagraph(placeholder, 'after', true)
    placeholder.Select()
    return true
  }

  // Selects the answer written from `start`. A text written in a line is
  // copied before the cursor: it ends where the run of the cursor starts.
  const selectAnswer = (start, isInline) => {
    const ending = isInline ? doc.GetCurrentRun() : lastWritten
    if (!ending) return
    const written = ending.GetRange()
    const endPos = isInline ? written.GetStartPos() : written.GetEndPos()
    written.SetStartPos(start)
    written.SetEndPos(endPos)
    written.Select()
  }

  // Blocks leave the end of the paragraph they were written in after them:
  // an empty paragraph, when they took the place of all its text. It stays
  // after a table that nothing else follows: a table cannot end a document.
  const removeLeftParagraph = last => {
    const parent = last.GetParentTableCell()?.GetContent() ?? doc
    const index = last.GetPosInParent()
    const rest = parent.GetElement(index + 1)
    const after = parent.GetElement(index + 2)
    const isNeeded =
      last.GetClassType() === 'table' && after?.GetClassType() !== 'paragraph'
    if (rest?.GetClassType() !== 'paragraph' || isNeeded) return
    // A note or an image that was after the text, or the end of a section,
    // stays
    if (isEmpty(rest)) rest.Delete()
  }

  function isAnswerOf(type) {
    return blocks.length === 1 && blocks[0].type === type
  }

  // A table with the rows and cells of the selected ones is written in them:
  // the table of the document keeps its style and its merged cells
  function canFillCells(selectedCells) {
    return (
      isReplace &&
      Boolean(selectedCells) &&
      isAnswerOf('table') &&
      hasSameShape(selectedCells, blocks[0])
    )
  }

  // Other answers to the cells of a table are written under the table, as an
  // answer with a table to a text of a cell
  function isReplacingText(selectedCells) {
    const isInCell = paragraphs.some(paragraph =>
      paragraph.GetParentTableCell()
    )
    return (
      isReplace &&
      !selectedCells &&
      !(hasTable && isInCell) &&
      Boolean(selection) &&
      getText(selection).trim() !== ''
    )
  }

  // A text written in a line is kept apart from the text around it by a
  // space on each side, unless there is one already
  const addGlueSpaces = (spans, { before, after }) => {
    const text = spans
      .map(span => (span.isBreak ? '\n' : (span.text ?? '')))
      .join('')
    const space = { text: ' ' }
    return [
      ...(/\S$/.test(before) && /^\S/.test(text) ? [space] : []),
      ...spans,
      ...(/\S$/.test(text) && /^\S/.test(after) ? [space] : [])
    ]
  }

  // Writes elements in place of the selection, a single paragraph in its line
  // (`isInline`), and selects them
  const writeAnswer = (elements, isInline) => {
    const start = doc.GetRangeBySelect().GetStartPos()
    if (!doc.InsertContent(elements, isInline)) return false

    const last = elements[elements.length - 1]
    // A block the editor copies instead of moving it has no known place: it
    // is left unselected
    const isMoved = !isInline && last.GetPosInParent() !== -1
    if (isInline || isMoved) selectAnswer(start, isInline)
    if (isMoved) removeLeftParagraph(last)
    return true
  }

  // In a part of the paragraphs, the answer joins the text around it, as a
  // pasted one: its first paragraph continues the text before the selection,
  // its last one the text after it, in the style of their paragraph. A
  // heading, an item, a table or a block of code stays a block of its own.
  const writeAround = ({ before, after, isSpaced = false }) => {
    const isPlain = block => block.type === 'paragraph'
    const isJoiningBefore = before !== '' && isPlain(blocks[0])
    const isJoiningAfter =
      after !== '' && blocks.length > 1 && isPlain(blocks[blocks.length - 1])
    const middle = blocks
      .slice(isJoiningBefore ? 1 : 0, isJoiningAfter ? -1 : undefined)
      .flatMap(makeElement)
    const answerStart = selection.GetStartPos()
    // The editor gives the text before the selection to the first block it
    // writes: an empty copy of its paragraph takes it, with its style and its
    // numbering, and the text after it stays in a paragraph of its own. That
    // one keeps the end of a section: a copy would end a section too.
    const [first] = paragraphs
    const isEndingSection = Boolean(
      JSON.parse(first.ToJSON(false, false)).pPr?.sectPr
    )
    const head = isEndingSection ? Api.CreateParagraph() : first.Copy()
    if (isEndingSection) {
      if (first.GetStyle()) head.SetStyle(first.GetStyle())
      if (first.GetNumbering()) head.SetNumbering(first.GetNumbering())
    } else {
      head.RemoveAllElements()
    }
    const following = paragraphs[paragraphs.length - 1].GetNext()
    if (!doc.InsertContent([head, ...middle], false)) return false

    const parent = head.GetParentTableCell()?.GetContent() ?? doc
    const lastBlock = middle[middle.length - 1] ?? head
    const tail = parent.GetElement(lastBlock.GetPosInParent() + 1)
    // An insert has the spaces the text around it needs, a replace keeps the
    // ones around the selection
    const writeInLine = (block, around, at) => {
      const spans = isSpaced ? addGlueSpaces(block.spans, around) : block.spans
      at.Select()
      doc.InsertContent([makeParagraph(spans, null, textPr)], true)
    }
    // The text before the selection has not moved
    if (isJoiningBefore) {
      writeInLine(
        blocks[0],
        { before, after: '' },
        doc.GetRange(answerStart, answerStart)
      )
    }
    if (isJoiningAfter) {
      writeInLine(
        blocks[blocks.length - 1],
        { before: '', after },
        tail.GetRange(0, 0)
      )
    }

    // The answer is left selected, without the text around it
    const startPos = isJoiningBefore
      ? answerStart
      : middle[0].GetRange().GetStartPos()
    const endPos = isJoiningAfter
      ? doc.GetCurrentRun().GetRange().GetStartPos()
      : lastBlock.GetRange().GetEndPos()
    doc.GetRange(startPos, endPos).Select()
    // An edge of the selection at an edge of its paragraph leaves an empty
    // paragraph, not the one that was there after it
    if (isEmpty(head)) head.Delete()
    const isLeft =
      tail?.GetClassType() === 'paragraph' &&
      tail.GetInternalId() !== following?.GetInternalId()
    if (isLeft && isEmpty(tail)) tail.Delete()
    return true
  }

  // A single paragraph is written in the line of the selection, and so is a
  // single block, as a heading or an item, in a part of a paragraph: the
  // paragraph keeps its own style. A table or a block of code stays a block
  // of its own.
  const replaceText = () => {
    skipEndOfLine()
    skipStartOfLine()
    const around = getAround()
    const isWhole = around.before === '' && around.after === ''
    const isPartOfParagraph = !isWhole && paragraphs.length === 1
    fitSelection(isWhole)
    textPr = findStartLook(paragraphs[0], selection.GetStartPos())
    // A heading numbered by its style is no list the items can join
    const [first] = paragraphs
    if (first.GetNumbering() && first.GetOutlineLvl() === undefined) {
      hostItem = first
    }
    const [block] = blocks
    const isLine =
      blocks.length === 1 &&
      (block.type === 'paragraph' ||
        (isPartOfParagraph && !['table', 'code'].includes(block.type)))
    if (isLine) {
      return writeAnswer([makeParagraph(block.spans, null, textPr)], true)
    }
    if (isWhole) return writeAnswer(blocks.flatMap(makeElement), false)
    return writeAround(getAround())
  }

  // An answer inserted in a line is written there as in place of an empty
  // selection, in the look of most of the text of its paragraph
  const insertAtCursor = ({ paragraph, range, before, after }) => {
    selection = range
    paragraphs = [paragraph]
    textPr = findMainLook(paragraph)
    range.Select()
    const [block] = blocks
    if (blocks.length === 1 && block.type === 'paragraph') {
      const spans = addGlueSpaces(block.spans, { before, after })
      return writeAnswer([makeParagraph(spans, null, textPr)], true)
    }
    return writeAround({ before, after, isSpaced: true })
  }

  // The selected text of a paragraph, without its mark nor the spaces around
  // it, which the answer of a LLM never has
  const findSelectedText = paragraph => {
    const whole = paragraph.GetRange()
    const range = doc.GetRange(
      Math.max(whole.GetStartPos(), selection.GetStartPos()),
      Math.min(whole.GetEndPos(), selection.GetEndPos())
    )
    shrinkRange(range, false, text => /\s$/.test(text))
    shrinkRange(range, true, text => /^\s/.test(text))
    return range
  }

  // What the selection takes, in the order of the document: the selected
  // text of each paragraph out of the tables that has one, and each table
  // with its selected cells by row
  const getMixedParts = () => {
    const parts = []
    paragraphs.forEach(paragraph => {
      const cell = paragraph.GetParentTableCell()
      if (!cell) {
        const range = findSelectedText(paragraph)
        if (getText(range) !== '') parts.push({ paragraph, range })
        return
      }
      const table = cell.GetParentTable()
      const last = parts[parts.length - 1]
      if (last?.table?.GetInternalId() === table.GetInternalId()) {
        last.cells.set(cell.GetInternalId(), cell)
        return
      }
      parts.push({ table, cells: new Map([[cell.GetInternalId(), cell]]) })
    })
    return parts.map(({ cells, ...part }) =>
      cells ? { ...part, rows: groupByRow(cells) } : part
    )
  }

  // The spans of a block written in a line: a block of code gives its lines
  function getLineSpans(block) {
    return (
      block.spans ??
      block.lines.flatMap((line, index) => [
        ...(index === 0 ? [] : [{ isBreak: true }]),
        { text: line, isCode: true }
      ])
    )
  }

  function getLastCell(table) {
    const lastRow = table.GetRow(table.GetRowsCount() - 1)
    return lastRow.GetCell(lastRow.GetCellsCount() - 1)
  }

  function getCellRange(cell, isEnd) {
    const content = cell.GetContent()
    const index = isEnd ? content.GetElementsCount() - 1 : 0
    return content.GetElement(index).GetRange()
  }

  // A block takes the place of the selected text of a paragraph, in its line.
  // Each part written gives the ranges of its start and of its end, read once
  // all are written: the start of a text is a position, right for the first
  // part only, written last.
  const writeText = ({ paragraph, range }, block) => {
    const start = range.GetStartPos()
    const getStart = () => doc.GetRange(start, start)
    if (!block) return { getStart, getEnd: () => paragraph.GetRange() }
    const look = findStartLook(paragraph, start)
    range.Select()
    doc.InsertContent([makeParagraph(getLineSpans(block), null, look)], true)
    // A text written in a line ends where the run of the cursor starts
    const ending = doc.GetCurrentRun()
    return { getStart, getEnd: () => ending.GetRange(0, 0) }
  }

  // The selected cells of a table take the cells of a table of the answer,
  // row by row, and a whole table of another shape takes its place, in its
  // look when it can be reshaped
  const writeCells = ({ table, rows }, answerTable) => {
    const isWhole = countSelected(rows) === countCells(table)
    if (isWhole && answerTable && !hasSameShape({ rows }, answerTable)) {
      const created =
        reshapeTable(table, answerTable, canReshape(table)) ??
        makeTable(answerTable.rows)
      const index = table.GetPosInParent()
      table.Delete()
      doc.AddElement(index, created)
      const lastCell = getLastCell(created)
      return {
        getStart: () => getCellRange(created.GetCell(0, 0), false),
        getEnd: () => getCellRange(lastCell, true)
      }
    }
    rows.forEach((cells, i) => {
      cells.forEach((cell, j) => {
        const answerCell = answerTable?.rows[i]?.[j]
        if (answerCell) fillCell(cell, answerCell)
        else skippedCells += 1
      })
    })
    const lastRow = rows[rows.length - 1]
    return {
      getStart: () => getCellRange(rows[0][0], false),
      getEnd: () => getCellRange(lastRow[lastRow.length - 1], true)
    }
  }

  // Across the edge of a table, the tables of the answer go in the tables of
  // the selection, in order, and its other blocks in place of the selected
  // texts, in order. The parts are written from the last one: the positions
  // of the ones before do not move.
  const replaceMixed = () => {
    const parts = getMixedParts()
    const tableParts = parts.filter(part => part.table)
    const textParts = parts.filter(part => !part.table)
    const answerTables = blocks.filter(block => block.type === 'table')
    const answerTexts = blocks.filter(block => block.type !== 'table')
    writtenBlocks = parts
      .map(part =>
        part.table
          ? answerTables[tableParts.indexOf(part)]
          : answerTexts[textParts.indexOf(part)]
      )
      .filter(Boolean)
    const edges = [...parts]
      .reverse()
      .map(part =>
        part.table
          ? writeCells(part, answerTables[tableParts.indexOf(part)])
          : writeText(part, answerTexts[textParts.indexOf(part)])
      )
    const [last] = edges
    const first = edges[edges.length - 1]
    first.getStart().ExpandTo(last.getEnd())?.Select()
    return true
  }

  // An answer to cells that it does not fill goes under their table, or in
  // place of the whole table. A table of the answer is a copy of theirs,
  // made before the place of the answer is selected: the editor moves its
  // cursor when the rows of a table change.
  const writeForCells = selectedCells => {
    const { table, rows } = selectedCells
    const isWhole = isReplacingTable(selectedCells)
    const isReshapable = canReshape(table)
    let wholeCopy = null
    const elements = blocks.flatMap(block => {
      if (block.type !== 'table') return makeElement(block)
      const copy = isWhole
        ? reshapeTable(table, block, isReshapable)
        : makeTableCopy(selectedCells, block, isReshapable)
      if (copy && !isWhole && !isReshapable) wholeCopy = copy
      return copy ?? makeTable(block.rows)
    })
    const placeholder = Api.CreateParagraph()
    placeAfterTable(placeholder, table, isWhole)
    placeholder.Select()
    if (!writeAnswer(elements, false)) return false
    // The last cell may have no run written to end the selection; in a whole
    // copy, only the selected cells hold the answer
    const [inserted] = elements
    if (!isAnswerOf('table') || inserted.GetPosInParent() === -1) return true
    const lastRow = rows[rows.length - 1]
    const [first, last] = wholeCopy
      ? [rows[0][0], lastRow[lastRow.length - 1]].map(cell =>
          wholeCopy.GetCell(cell.GetRowIndex(), cell.GetIndex())
        )
      : [inserted.GetCell(0, 0), getLastCell(inserted)]
    getCellRange(first, false).ExpandTo(getCellRange(last, true))?.Select()
    return true
  }

  const write = () => {
    if (isReplace && isCrossing) return replaceMixed()
    const selectedCells = getSelectedCells()
    if (canFillCells(selectedCells)) {
      fillCells(selectedCells, blocks[0])
      return true
    }
    if (isReplacingText(selectedCells)) return replaceText()
    if (!paragraphs.some(paragraph => paragraph.GetParentTableCell())) {
      skipStartOfLine()
    }
    const cursor = isReplace ? null : findCursor()
    if (cursor) return insertAtCursor(cursor)
    if (selectedCells) return writeForCells(selectedCells)
    if (!selectPlaceholder()) return false
    return writeAnswer(blocks.flatMap(makeElement), false)
  }

  // The markers of the images of blocks, in their order
  const listImages = listed =>
    listed.flatMap(block => {
      if (block.type === 'table') {
        return block.rows
          .flat()
          .flatMap(cell => listImages(cell.blocks ?? [cell]))
      }
      return (block.spans ?? [])
        .filter(span => span.image !== undefined)
        .map(span => span.image)
    })

  // The marker each drawing of the answer left selected is a copy for, in
  // their order, null when it is unknown. The editor copies what it writes in
  // a line, and the copies have no mark of their own: they are told by the
  // order the blocks are written in, when the selection holds as many.
  const findWrittenImages = () => {
    const numbers = listImages(writtenBlocks).filter(findOriginal)
    const found = findDrawings(doc.GetRangeBySelect())
    return found.length === numbers.length ? numbers : found.map(() => null)
  }

  const written = write()
  return { written, skippedCells, images: findWrittenImages() }
}
