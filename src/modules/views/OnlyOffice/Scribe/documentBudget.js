const PARAGRAPH_BREAK = '\n\n'

const isHighSurrogate = code => code >= 0xd800 && code <= 0xdbff

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
  if (lastBreak > 0) {
    return { document: text.slice(0, lastBreak), isTruncated: true }
  }
  // A text without a break in the budget is cut in its first paragraph,
  // rather than given empty, and not inside a character, as an emoji
  const end = isHighSurrogate(text.charCodeAt(budget - 1)) ? budget - 1 : budget
  return { document: text.slice(0, end), isTruncated: true }
}
