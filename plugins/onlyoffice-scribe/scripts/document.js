/* global Api, Asc */

// The functions of this file run inside the editor: the plugin sends their
// source to it with `callCommand`. They cannot use anything defined outside
// of them, and their parameters come in `Asc.scope`.

/**
 * Reads the text the scribe works on: the selection, or the whole document
 * without one. The Markdown of the editor gives the tables in HTML tags, one
 * cell after the other: the cells that take several columns or rows get
 * their `colspan` and `rowspan`.
 *
 * @returns {{ content: string, target: 'selection' | 'document',
 * canReplace: boolean }} the text, in Markdown, and whether an answer can take
 * its place
 */
export function readContent() {
  const doc = Api.GetDocument()
  const selection = doc.GetRangeBySelect()
  const hasSelection =
    Boolean(selection) && selection.GetText({ Numbering: false }).trim() !== ''
  // The editor converts the selection when there is one, even an empty one
  if (!hasSelection) doc.RemoveSelection()
  // The editor gives no paragraphs for a selection it does not let change,
  // as one that holds a locked content control: it is not replaced
  const selected = hasSelection ? selection.GetAllParagraphs() : []
  const isLocked = selected === null
  const paragraphs = selected ?? []

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

  // An answer is text: it cannot give back an image, a chart, an equation, a
  // note, a field, a form, a comment or a page break, nor take the place of a
  // text and a table together, or of the end of a section
  const KEPT =
    /"type":"(paraDrawing|paraMath|footnoteRef|endnoteRef|fldChar|inlineLvlSdt|blockLvlSdt|commentRangeStart)"|"breakType":"(page|column)"/
  const canReplace = () => {
    const tables = new Set(
      paragraphs.map(
        paragraph =>
          paragraph.GetParentTableCell()?.GetParentTable().GetInternalId() ??
          null
      )
    )
    const isCrossing = tables.size > 1
    // The copy of the selection leaves the ends of sections out
    const isEndingSection = paragraphs
      .slice(0, -1)
      .some(paragraph => JSON.parse(paragraph.ToJSON(false, false)).pPr?.sectPr)
    return (
      !isCrossing &&
      !isEndingSection &&
      !KEPT.test(selection.ToJSON(false, false))
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

  const content = describeMerges(doc.ToMarkdown())
  return {
    content: hasSelection ? removeMark(content) : content,
    target: hasSelection ? 'selection' : 'document',
    canReplace: hasSelection && !isLocked && canReplace()
  }
}

/**
 * Writes the blocks of an answer in the document, with the styles of the
 * document: in place of the selection (`Asc.scope.isReplace`), or after its
 * paragraph. The new text is left selected: the user sees it, and the next
 * answer can replace it.
 *
 * @returns {boolean} false when there was nowhere to write
 */
export function writeBlocks() {
  const { blocks, isReplace } = Asc.scope
  const doc = Api.GetDocument()
  function getText(element) {
    return element.GetText({ Numbering: false, ParaSeparator: '\n' })
  }
  // A cursor is no selection: once the document has been read, the editor
  // gives for it an empty range in the first cell of its table
  const range = doc.GetRangeBySelect()
  const selection =
    range && range.GetStartPos() < range.GetEndPos() ? range : null
  const paragraphs = selection?.GetAllParagraphs() ?? []
  // The editor writes a table in a table over its cells: a table of the
  // answer goes under the table of the selection, out of any other one
  const hasTable = blocks.some(block => block.type === 'table')
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
  const findStartLook = () => {
    const start = selection.GetStartPos()
    const paragraph = paragraphs[0]
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

  const makeRun = (span, textPr) => {
    const run = Api.CreateRun()
    if (textPr) run.SetTextPr(textPr)
    run.AddText(span.text)
    // The emphasis is the one of the answer, over the one of the style
    run.SetBold(span.isBold ? true : undefined)
    run.SetItalic(span.isItalic ? true : undefined)
    run.SetStrikeout(span.isStrike ? true : undefined)
    if (span.isCode) run.SetFontFamily('Courier New')
    return run
  }

  const addSpans = (paragraph, spans, textPr) => {
    spans.forEach(span => {
      if (span.isBreak) {
        paragraph.AddLineBreak()
        return
      }
      const element = span.href
        ? Api.CreateHyperlink(span.href, span.text)
        : makeRun(span, textPr)
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
          spans: cell.spans
        })
        column += colSpan
      })
    })
    return cells
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
      addSpans(content.GetElement(0), cell.spans, textPr)
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
    return makeParagraph(block.spans, null, textPr)
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
    const rows = new Map()
    cells.forEach(cell => {
      if (!rows.has(cell.GetRowIndex())) rows.set(cell.GetRowIndex(), [])
      rows.get(cell.GetRowIndex()).push(cell)
    })
    return {
      table,
      rows: [...rows.keys()]
        .sort((a, b) => a - b)
        .map(row => rows.get(row).sort((a, b) => a.GetIndex() - b.GetIndex()))
    }
  }

  // Writes the text of an answer in a cell, in the look of its text, with
  // the emphasis of the answer added
  const fillCell = (cell, spans) => {
    const content = cell.GetContent()
    const paragraph = content.GetElement(0)
    const first = paragraph.GetElement(0)
    const textPr = first?.GetClassType() === 'run' ? first.GetTextPr() : null
    for (let i = content.GetElementsCount() - 1; i > 0; i -= 1) {
      content.RemoveElement(i)
    }
    paragraph.RemoveAllElements()
    const kept = spans.map(span => ({
      ...span,
      isBold: span.isBold || textPr?.GetBold() === true,
      isItalic: span.isItalic || textPr?.GetItalic() === true
    }))
    addSpans(paragraph, kept, textPr)
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
      cells.forEach((cell, j) => fillCell(cell, table.rows[i][j].spans))
    })
    const cellCount = countSelected(selectedCells.rows)
    if (cellCount === countCells(selectedCells.table)) {
      selectedCells.table.Select()
    }
  }

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

  // Moves an end of the selection over what the answer does not replace
  const shrinkSelection = (isStart, isOut) => {
    let start = selection.GetStartPos()
    let end = selection.GetEndPos()
    while (end > start && isOut(getText(selection))) {
      if (isStart) selection.SetStartPos((start += 1))
      else selection.SetEndPos((end -= 1))
    }
  }

  // The answer takes the place of the text, in the paragraphs that hold it:
  // the mark that ends the last one is kept, and the spaces around a part of
  // a paragraph, which the answer of the LLM never has
  const fitSelection = isWhole => {
    shrinkSelection(false, text => text.endsWith('\n'))
    if (!isWhole) {
      shrinkSelection(true, text => /^\s/.test(text))
      shrinkSelection(false, text => /\s$/.test(text))
    }
    selection.Select()
  }

  // An answer to the cells of a table goes under the table. A whole table
  // replaced by an answer of another shape goes away: the answer takes its
  // place.
  const placeAfterTable = (placeholder, { table: selectedTable, rows }) => {
    const table = hasTable ? findOuterTable(selectedTable) : selectedTable
    const parent = table.GetParentTableCell()?.GetContent() ?? doc
    let index = table.GetPosInParent() + 1
    const isWhole =
      table === selectedTable && countSelected(rows) === countCells(table)
    if (isReplace && isWhole) {
      index -= 1
      table.Delete()
    }
    parent.AddElement(index, placeholder)
    return true
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
  const selectPlaceholder = selectedCells => {
    const placeholder = Api.CreateParagraph()
    if (selectedCells) {
      placeAfterTable(placeholder, selectedCells)
      placeholder.Select()
      return true
    }
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

  // Writes elements in place of the selection, a single paragraph in its line
  // (`isInline`), and selects them
  const writeAnswer = (elements, isInline) => {
    const start = doc.GetRangeBySelect().GetStartPos()
    if (!doc.InsertContent(elements, isInline)) return false

    const last = elements[elements.length - 1]
    // The editor copies the blocks it cannot move, as a table written in a
    // table: their place is unknown, and they are left unselected
    const isMoved = !isInline && last.GetPosInParent() !== -1
    if (isInline || isMoved) selectAnswer(start, isInline)
    if (isMoved) removeLeftParagraph(last)
    return true
  }

  // In a part of the paragraphs, the answer joins the text around it, as a
  // pasted one: its first paragraph continues the text before the selection,
  // its last one the text after it, in the style of their paragraph. A
  // heading, an item or a table stays a block of its own.
  const writeAround = ({ before, after }) => {
    const isPlain = block => block.type === 'paragraph'
    const isJoiningBefore = before !== '' && isPlain(blocks[0])
    const isJoiningAfter =
      after !== '' && blocks.length > 1 && isPlain(blocks[blocks.length - 1])
    const middle = blocks
      .slice(isJoiningBefore ? 1 : 0, isJoiningAfter ? -1 : undefined)
      .map(makeElement)
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
    const writeInLine = (block, at) => {
      at.Select()
      doc.InsertContent([makeParagraph(block.spans, null, textPr)], true)
    }
    // The text before the selection has not moved
    if (isJoiningBefore) {
      writeInLine(blocks[0], doc.GetRange(answerStart, answerStart))
    }
    if (isJoiningAfter)
      writeInLine(blocks[blocks.length - 1], tail.GetRange(0, 0))

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
  // single block in a part of a paragraph: the editor gives a part of a
  // heading or of a list item with its mark, which the answer keeps
  const replaceText = () => {
    skipEndOfLine()
    const around = getAround()
    const isWhole = around.before === '' && around.after === ''
    const isPartOfParagraph = !isWhole && paragraphs.length === 1
    fitSelection(isWhole)
    textPr = findStartLook()
    // A heading numbered by its style is no list the items can join
    const [first] = paragraphs
    if (first.GetNumbering() && first.GetOutlineLvl() === undefined) {
      hostItem = first
    }
    const [block] = blocks
    const isLine =
      blocks.length === 1 &&
      (block.type === 'paragraph' ||
        (isPartOfParagraph && block.type !== 'table'))
    if (isLine) {
      return writeAnswer([makeParagraph(block.spans, null, textPr)], true)
    }
    if (isWhole) return writeAnswer(blocks.map(makeElement), false)
    return writeAround(getAround())
  }

  const selectedCells = getSelectedCells()
  if (canFillCells(selectedCells)) {
    fillCells(selectedCells, blocks[0])
    return true
  }
  if (isReplacingText(selectedCells)) return replaceText()
  if (!selectPlaceholder(selectedCells)) return false
  return writeAnswer(blocks.map(makeElement), false)
}
