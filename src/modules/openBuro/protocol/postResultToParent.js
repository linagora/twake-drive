import { ERROR_CANCELLED, MESSAGE_READY } from '../constants'

/**
 * Send the best-effort READY notification to the parent window.
 * Clients are not required to implement it.
 */
export const postReady = ({ clientUrl, id }) => {
  window.parent.postMessage({ type: MESSAGE_READY, id }, clientUrl)
}

/**
 * Send a successful capability result to the parent window.
 */
export const postDone = ({ clientUrl, id, results }) => {
  window.parent.postMessage({ status: 'done', id, results }, clientUrl)
}

/**
 * Send an error result to the parent window.
 */
export const postError = ({ clientUrl, id, message }) => {
  window.parent.postMessage({ status: 'error', id, message }, clientUrl)
}

/**
 * Send the canonical cancellation error to the parent window.
 */
export const postCancelled = ({ clientUrl, id }) => {
  postError({ clientUrl, id, message: ERROR_CANCELLED })
}
