// Where the selection is drawn, read from the page of the editor without a
// command: a command empties the redo of the editor

function readViewer(editorWindow) {
  const box = editorWindow.document
    ?.getElementById('id_viewer')
    ?.getBoundingClientRect()
  if (!box) return null
  const { left, top, width, height } = box
  return { left, top, width, height }
}

// The editor gives zeros, or throws, while it has no document
function readCorners(editorWindow) {
  try {
    const corners = editorWindow.editor?.asc_GetSelectionBounds?.()
    const isRead =
      Array.isArray(corners) &&
      corners.length === 4 &&
      corners.every(
        corner =>
          Array.isArray(corner) &&
          corner.length === 2 &&
          corner.every(Number.isFinite)
      )
    if (!isRead || corners.flat().every(value => value === 0)) return null
    return corners
  } catch {
    return null
  }
}

// A cursor starts with no height. A selection that ends at the start of a
// paragraph has no width, and is not a cursor.
function isCursor([[x0, y0], [x1, y1]]) {
  return x0 === x1 && y0 === y1
}

function makeRect(corners) {
  const xs = corners.map(([x]) => x)
  const ys = corners.map(([, y]) => y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
    corners
  }
}

/**
 * The selection and the viewer of the editor, in pixels of its frame. The
 * selection is null for a cursor alone, or without text.
 */
export function readGeometry(editorWindow, hasText) {
  const viewer = readViewer(editorWindow)
  const corners = hasText && viewer ? readCorners(editorWindow) : null
  if (!corners || isCursor(corners)) {
    return { selection: null, viewer, page: null }
  }

  // The editor gives the corners from the top left of its viewer
  const rect = makeRect(
    corners.map(([x, y]) => [x + viewer.left, y + viewer.top])
  )
  return { selection: { rect, hasText }, viewer, page: null }
}

export function isSameGeometry(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every(key => isSameGeometry(a[key], b[key]))
  )
}
