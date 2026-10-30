const PANEL_OPEN_KEY = 'scribe-panel-open'
const PANEL_MIN_WIDTH = 280
const PANEL_MAX_WINDOW_SHARE = 0.6

export const PANEL_DEFAULT_WIDTH = 400

// A private window may throw on any access to localStorage: the panel then
// works as if it had never been opened
export const readPanelOpen = () => {
  try {
    return localStorage.getItem(PANEL_OPEN_KEY) === 'true'
  } catch {
    return false
  }
}

export const writePanelOpen = isOpen => {
  try {
    localStorage.setItem(PANEL_OPEN_KEY, String(isOpen))
  } catch {
    // Then not kept for the next load
  }
}

export const clampPanelWidth = (width, windowWidth) => {
  const maxWidth = windowWidth * PANEL_MAX_WINDOW_SHARE
  // Too narrow a window for both: the panel takes the place of the document
  if (maxWidth < PANEL_MIN_WIDTH) return windowWidth
  return Math.min(Math.max(width, PANEL_MIN_WIDTH), maxWidth)
}
