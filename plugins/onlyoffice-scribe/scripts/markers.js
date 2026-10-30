/* global Api, Asc */

// The functions of this file run inside the editor: the plugin sends their
// source to it with `callCommand`. They cannot use anything defined outside
// of them, and their parameters come in `Asc.scope`.

/**
 * Writes the notes and the references of the answer that `writeBlocks` has
 * written and left selected: each placeholder of a note marker takes a new
 * note, whose text is the one of the marker (`Asc.scope.notes`, the N-th for
 * the marker N), and the text between the placeholders of a reference
 * becomes a link to the place of the reference (`Asc.scope.refs`). The
 * placeholder of a marker the text read did not give is removed, and so are
 * the placeholders of a reference whose place is not found: its text stays
 * plain. The answer stays selected.
 *
 * @returns {boolean}
 */
export function writeMarkers() {
  const { notes = [], refs = [] } = Asc.scope
  const doc = Api.GetDocument()
  const answer = doc.GetRangeBySelect()
  const paragraphs = answer?.GetAllParagraphs() ?? []
  // Between U+FDD0, a noncharacter, which no text of a document holds. Not
  // NUL: the editor reads no NUL back from its runs since its version 10.
  const PLACEHOLDER =
    /\uFDD0fn:(?<note>\d+)\uFDD0|\uFDD0ref:(?<ref>\d+)\uFDD0(?<text>[^\uFDD0]*)\uFDD0\/ref\uFDD0/
  const REF_END = '\uFDD0/ref\uFDD0'

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

  const countText = (paragraph, position = Infinity) =>
    getRuns(paragraph).reduce((count, run) => {
      const { length } = run.GetText()
      const before = position - run.GetRange().GetStartPos()
      return count + Math.min(Math.max(before, 0), length)
    }, 0)

  const findPlaceholder = () => {
    for (const run of paragraphs.flatMap(getRuns)) {
      const match = run.GetText().match(PLACEHOLDER)
      if (match) return { run, match }
    }
    return null
  }

  // The editor stays in the note it adds, and a range selected in the text
  // does not take it back there: a cursor moved in a run does
  const selectInRun = (run, start, end) => {
    run.MoveCursorToPos(start)
    const range = run.GetRange(start, end)
    range.Select()
    return range
  }

  // The editor adds a note after the selected text, in a run of its own: the
  // placeholder keeps its place in its run until it is removed
  const writeNote = ({ run, match }) => {
    const end = match.index + match[0].length
    const text = notes[Number(match.groups.note) - 1]
    if (typeof text === 'string') {
      selectInRun(run, match.index, end)
      const content = doc.AddFootnote()
      const noteRun = Api.CreateRun()
      noteRun.AddText(text)
      content?.GetElement(0).AddElement(noteRun)
    }
    selectInRun(run, match.index, end).Delete()
  }

  const findHeading = anchor => {
    const name = anchor
      .replace(/^_/, '')
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase()
    return (
      doc
        .GetAllHeadingParagraphs()
        .find(
          heading =>
            heading.GetText({ Numbering: false }).trim().toLowerCase() === name
        ) ?? null
    )
  }

  // A bookmark added under a name in use moves there, with the links to it
  const makeBookmarkName = number => {
    const names = doc.GetAllBookmarksNames()
    let index = number
    while (names.includes(`scribe_heading_${index}`)) index += 1
    return `scribe_heading_${index}`
  }

  // The builder lists no bookmark whose name starts with `_`, as the one of
  // a heading: the JSON of the headings has them
  let headingBookmarks = null
  const hasBookmark = name => {
    if (!name.startsWith('_')) return doc.GetAllBookmarksNames().includes(name)
    if (!headingBookmarks) {
      headingBookmarks = doc.GetAllHeadingParagraphs().flatMap(paragraph =>
        JSON.parse(paragraph.ToJSON(false, false))
          .content.filter(element => element.type === 'bookmarkStart')
          .map(element => element.name)
      )
    }
    return headingBookmarks.includes(name)
  }

  // The bookmark of the reference N, if the answer has not replaced the text
  // that held it, or else a single bookmark on the heading its anchor names:
  // `_` before its text and for its spaces, as Word and the editor name them
  const madeBookmarks = new Map()
  const ensureBookmark = number => {
    const ref = refs[number - 1]
    if (typeof ref?.anchor !== 'string') return null
    const { anchor, kind } = ref
    if (kind === 'bookmark' && hasBookmark(anchor)) return anchor
    if (!anchor.startsWith('_')) return null
    if (madeBookmarks.has(anchor)) return madeBookmarks.get(anchor)
    const heading = findHeading(anchor)
    if (!heading) return null
    const name = makeBookmarkName(number)
    heading.GetRange().AddBookmark(name)
    madeBookmarks.set(anchor, name)
    return name
  }

  // The placeholders are removed before the link splits the run, the end one
  // first: removing the start one moves it
  const writeRef = ({ run, match }) => {
    const { ref, text } = match.groups
    const start = match.index
    const textEnd = start + match[0].length - REF_END.length
    const textStart = textEnd - text.length
    selectInRun(run, textEnd, textEnd + REF_END.length).Delete()
    selectInRun(run, start, textStart).Delete()
    const bookmark = ensureBookmark(Number(ref))
    if (bookmark) {
      run.GetRange(start, start + text.length).AddHyperlink('', '', bookmark)
    }
  }

  // A run at an offset of the text of a paragraph. Between two runs, the
  // start of the answer is in the later one and its end in the earlier one:
  // a note reference of the text around it, which has no text, stays out.
  const findCursor = (paragraph, offset, isStart) => {
    const runs = getRuns(paragraph)
    let passed = 0
    for (const [index, run] of runs.entries()) {
      const { length } = run.GetText()
      const isIn = isStart
        ? offset < passed + length
        : offset <= passed + length
      if (isIn) return { runs, index, at: offset - passed }
      passed += length
    }
    const index = runs.length - 1
    return isStart && index >= 0
      ? { runs, index, at: runs[index].GetText().length }
      : null
  }

  // The notes an answer starts or ends with are in runs of their own, out of
  // the text: they are left selected with it, as many as it has there, and
  // the next answer of the conversation, which gives them back, replaces
  // them. A note of the text around the answer stays out.
  const NOTE_REFERENCE = /"type":"footnoteRef"/
  const takeNotes = ({ runs, index }, count, step) => {
    let taken = index
    let left = count
    for (let i = index + step; left > 0 && runs[i]; i += step) {
      if (runs[i].GetText() !== '') break
      if (NOTE_REFERENCE.test(runs[i].ToJSON())) {
        taken = i
        left -= 1
      }
    }
    return taken
  }

  const count = paragraphs
    .flatMap(getRuns)
    .reduce(
      (sum, run) =>
        sum + (run.GetText().match(new RegExp(PLACEHOLDER, 'g'))?.length ?? 0),
      0
    )
  if (count === 0) return true

  // The answer is found again by the text around it, which does not change:
  // the editor removes the runs the placeholders leave empty
  const first = paragraphs[0]
  const last = paragraphs[paragraphs.length - 1]
  const head = countText(first, answer.GetStartPos())
  const tail = countText(last) - countText(last, answer.GetEndPos())
  // Only the notes of the text read are written
  const isKnownNote = note => typeof notes[Number(note) - 1] === 'string'
  const answerText = answer.GetText().trim()
  const knownNotes = new RegExp(PLACEHOLDER, 'g')
  const countKnown = text =>
    [...text.matchAll(knownNotes)].filter(({ groups }) =>
      isKnownNote(groups.note)
    ).length
  const leadingNotes = countKnown(
    answerText.match(new RegExp(`^(?:${PLACEHOLDER.source})+`))?.[0] ?? ''
  )
  const trailingNotes = countKnown(
    answerText.match(new RegExp(`(?:${PLACEHOLDER.source})+$`))?.[0] ?? ''
  )

  // A placeholder the editor would not remove is not written twice
  for (let i = 0; i < count; i += 1) {
    const found = findPlaceholder()
    if (!found) break
    if (found.match.groups.note) writeNote(found)
    else writeRef(found)
  }

  const start = findCursor(first, head, true)
  const end = findCursor(last, countText(last) - tail)
  if (start && end) {
    const startIndex = takeNotes(start, leadingNotes, -1)
    const endIndex = takeNotes(end, trailingNotes, 1)
    const startRun = start.runs[startIndex]
    const endRun = end.runs[endIndex]
    const startAt = startIndex === start.index ? start.at : 0
    const endRange =
      endIndex === end.index
        ? endRun.GetRange(end.at, end.at)
        : endRun.GetRange()
    selectInRun(startRun, startAt, startAt).ExpandTo(endRange)?.Select()
  }
  return true
}
