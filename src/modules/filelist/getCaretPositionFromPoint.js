/**
 * Get the caret offset in a text input from mouse coordinates.
 *
 * Uses `document.caretPositionFromPoint` (standard, Firefox) or
 * `document.caretRangeFromPoint` (legacy, Chrome/Safari) to determine
 * which character position the user clicked on.
 *
 * @param {number} x - clientX from the mouse event
 * @param {number} y - clientY from the mouse event
 * @returns {number|null} The character offset, or null if it cannot be determined
 */
export const getCaretPositionFromPoint = (x, y) => {
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y)
    if (pos) return pos.offset
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y)
    if (range) return range.startOffset
  }
  return null
}
