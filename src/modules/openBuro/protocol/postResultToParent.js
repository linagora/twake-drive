import { ERROR_CANCELLED, MESSAGE_READY } from '../constants'

/**
 * Returns the window that should receive OpenBuro capability messages.
 * When the capability target is embedded as an iframe, this is `window.parent`.
 * When opened as a popup, this is `window.opener`. Popups are top-level (so
 * `window.parent === window`) but have a non-null `window.opener`, which makes
 * it the reliable discriminator.
 */
const getRecipientWindow = () => window.opener || window.parent

/**
 * Closes the current window if it was opened as a popup. No-op in iframe mode.
 * Called after terminal messages (done / error / cancelled) so the picker
 * dismisses itself.
 */
const closeIfPopup = () => {
  if (window.opener) window.close()
}

/**
 * Send the best-effort READY notification to the parent window.
 * Clients are not required to implement it.
 */
export const postReady = ({ clientUrl, id }) => {
  getRecipientWindow().postMessage({ type: MESSAGE_READY, id }, clientUrl)
}

/**
 * Send a successful capability result to the parent window.
 */
export const postDone = ({ clientUrl, id, results }) => {
  getRecipientWindow().postMessage(
    { status: 'done', id, results },
    clientUrl
  )
  closeIfPopup()
}

/**
 * Send an error result to the parent window.
 */
export const postError = ({ clientUrl, id, message }) => {
  getRecipientWindow().postMessage(
    { status: 'error', id, message },
    clientUrl
  )
  closeIfPopup()
}

/**
 * Send the canonical cancellation error to the parent window.
 */
export const postCancelled = ({ clientUrl, id }) => {
  postError({ clientUrl, id, message: ERROR_CANCELLED })
}
