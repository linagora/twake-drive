const PARAGRAPH_BREAK = '\n\n'

/**
 * The head of the whole document the assistant gets, within a budget of
 * characters: up to the last paragraph break that fits
 *
 * @param {string} text - the Markdown of the whole document
 * @param {number | null | undefined} budget - unset or not positive: no cut
 * @returns {{ document: string, isTruncated: boolean }}
 */
export const cutDocument = (text, budget) => {
  if (!(budget > 0) || text.length <= budget) {
    return { document: text, isTruncated: false }
  }
  const lastBreak = text.lastIndexOf(PARAGRAPH_BREAK, budget)
  // A text without a break in the budget is cut in its first paragraph,
  // rather than given empty
  const end = lastBreak > 0 ? lastBreak : budget
  return { document: text.slice(0, end), isTruncated: true }
}
