/* global Api, Asc */

// The functions of this file run inside the presentation editor: the plugin
// sends their source to it with `callCommand`. They cannot use anything
// defined outside of them, and their parameters come in `Asc.scope`.
//
// A slide is made of shapes that hold paragraphs. The text the scribe works
// on is the selected text, the text of a selected shape, or the whole slide.
// An answer is written as paragraphs of the shape, which keep its look, with
// the emphasis of the answer (bold, italic, strikethrough).

/**
 * Reads the text the scribe works on, in a Markdown where a title is a
 * heading, the paragraphs of a body are the items of a list, and the other
 * paragraphs are lines. Whole paragraphs keep the emphasis set on their text.
 *
 * @returns {{ content: string, target: 'selection' | 'slide' }}
 * `Asc.scope.selectedText` holds the selected text, which the editor gives
 * to the plugin only
 */
export function readSlideContent() {
  const { selectedText } = Asc.scope
  const presentation = Api.GetPresentation()
  const slide = presentation.GetSlideByIndex(presentation.GetCurSlideIndex())
  const selection = Api.GetSelection()
  const type = selection.GetType()
  const shapes = selection.GetShapes()

  const isTitle = shape =>
    ['title', 'ctrTitle'].includes(shape.GetPlaceholder()?.GetType())
  // The paragraphs of a body placeholder are the bullets of the slide
  const isBody = shape => {
    const type = shape.GetPlaceholder()?.GetType()
    return (
      Boolean(type) &&
      ![
        'title',
        'ctrTitle',
        'subTitle',
        'date',
        'footer',
        'header',
        'sldNumber'
      ].includes(type)
    )
  }
  // The emphasis set on a run, as Markdown marks. The look a run takes from
  // its shape, as the bold of a title, is not one.
  const getMarks = run => {
    const textPr = run.GetTextPr()
    return [
      textPr.GetBold() === true ? '**' : '',
      textPr.GetItalic() === true ? '*' : '',
      textPr.GetStrikeout() === true ? '~~' : ''
    ].join('')
  }
  const getElementText = element =>
    (element.GetText?.() ?? '').replace(/[\r\n]+/g, '')
  // The texts of a paragraph, each with its marks, the ones of a same look
  // joined
  const readParts = paragraph => {
    const parts = []
    for (let index = 0; index < paragraph.GetElementsCount(); index += 1) {
      const element = paragraph.GetElement(index)
      const text = getElementText(element)
      if (text === '') continue
      const marks = element.GetClassType() === 'run' ? getMarks(element) : ''
      const previous = parts[parts.length - 1]
      if (previous?.marks === marks) previous.text += text
      else parts.push({ text, marks })
    }
    return parts
  }
  // A mark cannot open after a space nor close before one: the spaces around
  // the text of a part are left outside of its marks
  const wrapPart = ({ text, marks }) => {
    const [, before, core, after] = text.match(/^(\s*)(.*?)(\s*)$/s)
    if (!marks || core === '') return text
    const closing = marks.split('').reverse().join('')
    return `${before}${marks}${core}${closing}${after}`
  }
  const toMarkdown = paragraph => readParts(paragraph).map(wrapPart).join('')
  const getLines = shape => {
    const content = shape.GetDocContent()
    if (!content) return []
    return Array.from({ length: content.GetElementsCount() }, (_, index) =>
      content.GetElement(index)
    )
      .filter(element => element.GetClassType() === 'paragraph')
      .map(paragraph => ({
        text: paragraph.GetText().replace(/[\r\n]+$/, ''),
        markdown: toMarkdown(paragraph)
      }))
      .filter(line => line.text.trim() !== '')
  }
  const getMarkdown = lines => lines.map(line => line.markdown)
  const describe = (shape, lines) => {
    if (isTitle(shape)) return lines.map(line => `# ${line}`).join('\n\n')
    if (isBody(shape)) return lines.map(line => `- ${line}`).join('\n')
    return lines.join('\n\n')
  }

  if (type === 'text' && selectedText.trim() !== '') {
    const lines = selectedText.replace(/\n$/, '').split('\n')
    // A part of a paragraph is a text, not an item of the list, and has no
    // emphasis
    const paragraphs = getLines(shapes[0])
    const found = lines.map(line =>
      paragraphs.find(paragraph => paragraph.text === line)
    )
    const isWhole = found.every(Boolean)
    const content = isWhole
      ? describe(shapes[0], getMarkdown(found))
      : lines.join('\n\n')
    return { content, target: 'selection' }
  }
  if (type === 'shapes' && shapes.length === 1 && getLines(shapes[0]).length) {
    const content = describe(shapes[0], getMarkdown(getLines(shapes[0])))
    return { content, target: 'selection' }
  }

  const content = slide
    .GetAllShapes()
    .map(shape => describe(shape, getMarkdown(getLines(shape))))
    .filter(text => text !== '')
    .join('\n\n')
  return { content, target: 'slide' }
}

/**
 * Writes the lines of an answer as paragraphs: in place of the selected ones
 * (`Asc.scope.isReplace`), or after the paragraph of the cursor. The first
 * paragraph written is left selected, and all of them are given back: the
 * next answer takes their place while the selection is still on them.
 *
 * `Asc.scope.lineSpans` holds the lines, as spans with their emphasis,
 * `Asc.scope.selectedText` the selected text, and `Asc.scope.written` the
 * paragraphs of the former answer.
 *
 * @returns {{ shapeId: string, ids: string[] } | { isInline: true } | null}
 * what was written; `isInline` when the editor itself has to replace a text
 * selected inside paragraphs (`ReplaceTextSmart`); null when there was
 * nowhere to write
 */
export function writeSlideLines() {
  const { lineSpans, isReplace, selectedText, written } = Asc.scope
  const presentation = Api.GetPresentation()
  const slide = presentation.GetSlideByIndex(presentation.GetCurSlideIndex())
  const selection = Api.GetSelection()
  const type = selection.GetType()
  const selectedShapes = selection.GetShapes()

  const getParagraphs = content =>
    Array.from({ length: content.GetElementsCount() }, (_, index) =>
      content.GetElement(index)
    ).filter(element => element.GetClassType() === 'paragraph')
  const getText = paragraph => paragraph.GetText().replace(/[\r\n]+$/, '')
  const hasText = shape =>
    Boolean(shape.GetDocContent()) &&
    getParagraphs(shape.GetDocContent()).some(
      paragraph => getText(paragraph).trim() !== ''
    )
  const isTitle = shape =>
    ['title', 'ctrTitle'].includes(shape.GetPlaceholder()?.GetType())

  // The shape written in: the one of the selection, or the body of the slide
  const findShape = () => {
    if (selectedShapes[0]?.GetDocContent()) return selectedShapes[0]
    const shapes = slide.GetAllShapes().filter(shape => shape.GetDocContent())
    return (
      shapes.find(shape => !isTitle(shape) && hasText(shape)) ??
      shapes.find(shape => !isTitle(shape)) ??
      shapes[0] ??
      null
    )
  }

  // Whether a paragraph holds a line of the selection: the first line ends
  // the first paragraph, the last one starts the last paragraph
  const holdsLine = (text, line, index, count) => {
    if (count === 1) return text.includes(line)
    if (index === 0) return text.endsWith(line)
    if (index === count - 1) return text.startsWith(line)
    return text.includes(line)
  }
  const holdsLines = (candidates, lines) =>
    candidates.length === lines.length &&
    candidates.every((paragraph, index) =>
      holdsLine(getText(paragraph), lines[index], index, lines.length)
    )
  const isWholeLines = (candidates, lines) =>
    candidates.every((paragraph, index) => getText(paragraph) === lines[index])

  // The selected paragraphs: the lines of the selection, around the one of
  // the cursor. A line that is not a whole paragraph is selected inside it.
  const findSelected = (paragraphs, content) => {
    const selectedLines = selectedText.replace(/\n$/, '').split('\n')
    const current = content.GetCurrentParagraph()
    const currentIndex = paragraphs.findIndex(
      paragraph => paragraph.GetInternalId() === current?.GetInternalId()
    )
    const count = selectedLines.length
    const first = Math.max(0, currentIndex - count + 1)
    for (let start = first; start <= currentIndex; start += 1) {
      const candidates = paragraphs.slice(start, start + count)
      if (holdsLines(candidates, selectedLines)) {
        const isWhole = isWholeLines(candidates, selectedLines)
        return { paragraphs: candidates, isWhole }
      }
    }
    return { paragraphs: currentIndex === -1 ? [] : [current], isWhole: false }
  }

  // The paragraphs of the former answer, when the selection is still its
  // first one
  const findWritten = (paragraphs, shape) => {
    if (written?.shapeId !== shape.GetInternalId()) return null
    const found = written.ids.map(id =>
      paragraphs.find(paragraph => paragraph.GetInternalId() === id)
    )
    if (found.some(paragraph => !paragraph)) return null
    return getText(found[0]) === selectedText.replace(/\n$/, '') ? found : null
  }

  const shape = findShape()
  if (!shape) return null
  const content = shape.GetDocContent()
  const paragraphs = getParagraphs(content)
  const isTextSelected = type === 'text' && selectedText.trim() !== ''

  let targets = []
  let isWhole = true
  if (isTextSelected) {
    const kept = findWritten(paragraphs, shape)
    if (kept) {
      targets = kept
    } else {
      ;({ paragraphs: targets, isWhole } = findSelected(paragraphs, content))
    }
  } else if (type === 'shapes' && selectedShapes.length === 1) {
    targets = paragraphs
  }

  // A text selected inside paragraphs is replaced by the editor, which keeps
  // the look of what is around
  if (isReplace && targets.length > 0 && !isWhole) return { isInline: true }

  const writtenParagraphs = []
  // The look of a paragraph is the one of most of its text: a word set apart,
  // as a word in color, does not give its look to the whole line
  const findTextPr = paragraph => {
    let found = null
    let foundLength = -1
    for (let index = 0; index < paragraph.GetElementsCount(); index += 1) {
      const element = paragraph.GetElement(index)
      if (element.GetClassType() !== 'run') continue
      const { length } = element.GetText()
      if (length > foundLength) {
        found = element
        foundLength = length
      }
    }
    return found?.GetTextPr() ?? null
  }
  // A line is written in the look of the paragraph, with the emphasis of the
  // answer over it
  const writeLine = (paragraph, index) => {
    const textPr = findTextPr(paragraph)
    paragraph.RemoveAllElements()
    lineSpans[index].forEach(span => {
      const run = Api.CreateRun()
      if (textPr) run.SetTextPr(textPr)
      run.AddText(span.text)
      run.SetBold(span.isBold ? true : undefined)
      run.SetItalic(span.isItalic ? true : undefined)
      run.SetStrikeout(span.isStrike ? true : undefined)
      if (span.isCode) run.SetFontFamily('Courier New')
      paragraph.AddElement(run)
    })
    writtenParagraphs.push(paragraph)
  }
  // New paragraphs are copies of the one before them: they keep its look
  const addAfter = (anchor, from) => {
    let previous = anchor
    for (let index = from; index < lineSpans.length; index += 1) {
      const paragraph = previous.Copy()
      content.AddElement(previous.GetPosInParent() + 1, paragraph)
      writeLine(paragraph, index)
      previous = paragraph
    }
  }

  if (isReplace && targets.length > 0) {
    targets.forEach((paragraph, index) => {
      if (index < lineSpans.length) writeLine(paragraph, index)
      else paragraph.Delete()
    })
    const last = writtenParagraphs[writtenParagraphs.length - 1]
    addAfter(last, targets.length)
  } else {
    // After the selection or the cursor, or at the end of the shape
    const current =
      type === 'text' && !isTextSelected ? content.GetCurrentParagraph() : null
    const anchor =
      targets[targets.length - 1] ??
      current ??
      paragraphs[paragraphs.length - 1] ??
      null
    if (!anchor) return null
    // An empty paragraph, as the one of an empty shape, takes the first line
    if (getText(anchor).trim() === '') {
      writeLine(anchor, 0)
      addAfter(anchor, 1)
    } else {
      addAfter(anchor, 0)
    }
  }

  if (writtenParagraphs.length > 0) writtenParagraphs[0].Select()

  return {
    shapeId: shape.GetInternalId(),
    ids: writtenParagraphs.map(paragraph => paragraph.GetInternalId())
  }
}

/**
 * Gives the paragraphs the editor has just written in place of a text
 * selected inside paragraphs: the ones from the cursor on, as many as the
 * lines written (`Asc.scope.count`)
 *
 * @returns {{ shapeId: string, ids: string[] } | null}
 */
export function findWrittenParagraphs() {
  const { count } = Asc.scope
  const shape = Api.GetSelection().GetShapes()[0]
  const content = shape?.GetDocContent()
  const current = content?.GetCurrentParagraph()
  if (!current) return null

  const paragraphs = Array.from(
    { length: content.GetElementsCount() },
    (_, index) => content.GetElement(index)
  ).filter(element => element.GetClassType() === 'paragraph')
  const start = paragraphs.findIndex(
    paragraph => paragraph.GetInternalId() === current.GetInternalId()
  )

  return {
    shapeId: shape.GetInternalId(),
    ids: paragraphs
      .slice(start, start + count)
      .map(paragraph => paragraph.GetInternalId())
  }
}

/**
 * Adds a slide right after the current one, with a title and bullets, and
 * makes it the current slide. The slide has the "title and content" layout of
 * the master of the current slide, or else its first layout with a title and
 * a body, or else the layout of the current slide: the title and the bullets
 * are written in its placeholders, which keep the look of the layout. A text
 * the layout has no placeholder for is written in a text box.
 *
 * `Asc.scope.title` holds the title, `Asc.scope.bullets` the lines of the
 * body; an empty title or no bullets leave their placeholder empty.
 *
 * @returns {{ index: number }} the position of the new slide
 */
export function insertSlide() {
  const { title, bullets } = Asc.scope
  const presentation = Api.GetPresentation()
  const currentIndex = presentation.GetCurSlideIndex()
  const current = presentation.GetSlideByIndex(currentIndex)
  const master = current?.GetLayout()?.GetMaster() ?? presentation.GetMaster(0)

  const getType = shape => shape.GetPlaceholder()?.GetType() ?? null
  const isTitle = shape => ['title', 'ctrTitle'].includes(getType(shape))
  // A placeholder for text: the body of a "title and content" layout has no
  // type of its own, and the editor calls it unknown
  const isBody = shape => ['body', 'object', 'unknown'].includes(getType(shape))
  const hasTitleAndBody = layout =>
    layout.GetAllShapes().some(isTitle) && layout.GetAllShapes().some(isBody)

  const layouts = Array.from({ length: master.GetLayoutsCount() }, (_, index) =>
    master.GetLayout(index)
  )
  const findLayout = type =>
    layouts.find(layout => layout.GetLayoutType() === type) ?? null
  const currentLayout = current?.GetLayout() ?? null
  // "Title and content", or else "title and text" from older templates, or
  // else the layout of the current slide when it has both, or else any one
  // that has both
  const layout =
    findLayout('obj') ??
    findLayout('tx') ??
    (currentLayout && hasTitleAndBody(currentLayout) ? currentLayout : null) ??
    layouts.find(hasTitleAndBody) ??
    currentLayout ??
    layouts[0]

  const slide = Api.CreateSlide()
  // Without a current slide, the new one goes at the end
  const index =
    currentIndex === -1 ? presentation.GetSlidesCount() : currentIndex + 1
  presentation.AddSlide(slide, index)
  slide.ApplyLayout(layout)

  const shapes = slide.GetAllShapes()
  const titleShape = shapes.find(isTitle) ?? null
  // A title slide has a subtitle where another one has a body
  const bodyShape =
    shapes.find(isBody) ??
    shapes.find(shape => getType(shape) === 'subTitle') ??
    null

  // The first paragraph of a placeholder holds its look: the others are
  // copies of it
  const writeLines = (shape, lines) => {
    const content = shape.GetDocContent()
    let previous = content.GetElement(0)
    previous.SetText(lines[0])
    lines.slice(1).forEach(line => {
      const paragraph = previous.Copy()
      content.AddElement(previous.GetPosInParent() + 1, paragraph)
      paragraph.SetText(line)
      previous = paragraph
    })
  }
  const addTextBox = () => {
    const width = presentation.GetWidth()
    const height = presentation.GetHeight()
    const shape = Api.CreateShape(
      'rect',
      width * 0.84,
      height * 0.6,
      Api.CreateNoFill(),
      Api.CreateStroke(0, Api.CreateNoFill())
    )
    shape.SetPosition(width * 0.08, height * 0.28)
    slide.AddObject(shape)
    return shape
  }

  const bodyLines = titleShape || !title ? [...bullets] : [title, ...bullets]
  if (titleShape && title) writeLines(titleShape, [title])
  if (bodyLines.length > 0) writeLines(bodyShape ?? addTextBox(), bodyLines)

  slide.Select()
  return { index }
}
