/**
 * cozy-bridge protocol constants, message factories, and validators.
 *
 * Defines the wire format for intent-based communication between
 * OnlyOffice plugins (iframe) and Cozy Drive (host) via postMessage.
 *
 * @module cozy-bridge/protocol
 */

/** @type {number} Current protocol version */
export const PROTOCOL_VERSION = 1

/** @type {string} Message type for intents (plugin -> host) */
export const MSG_TYPE_INTENT = 'cozy-bridge:intent'

/** @type {string} Message type for responses (host -> plugin) */
export const MSG_TYPE_RESPONSE = 'cozy-bridge:response'

/**
 * Known intent action verbs.
 * PANEL_ACTION is a one-way command sent from Cozy Drive (host) down to the
 * plugin iframe, carrying a direct Replace/Insert instruction that does NOT
 * require a pending-intent/respond round-trip. Used by panel AI messages
 * where no prior AI_TEXT_ASSISTANT intent was ever emitted.
 * @type {Object<string,string>}
 */
export const INTENT_ACTIONS = {
  AI_TEXT_ASSISTANT: 'AI_TEXT_ASSISTANT',
  TOGGLE_SCRIBE_PANEL: 'TOGGLE_SCRIBE_PANEL',
  SELECTION_CHANGED: 'SELECTION_CHANGED',
  PANEL_ACTION: 'PANEL_ACTION'
}

/** @type {number} Maximum allowed size for message data payload (1MB) */
const MAX_DATA_SIZE = 1_000_000

/**
 * Create an intent message to be sent from a plugin to Cozy Drive.
 *
 * @param {string} action - Intent action verb, e.g. 'AI_TEXT_ASSISTANT'
 * @param {Object} data - Intent payload
 * @param {string} source - Sender identity, e.g. 'onlyoffice-plugin'
 * @returns {import('./types').IntentMessage}
 */
export function createIntentMessage(action, data, source) {
  return {
    type: MSG_TYPE_INTENT,
    version: PROTOCOL_VERSION,
    intentId: crypto.randomUUID(),
    action,
    source,
    data: data || {}
  }
}

/**
 * Create a response message to be sent from Cozy Drive back to a plugin.
 *
 * @param {string} intentId - Correlation ID from the original intent
 * @param {string} status - 'ok' or 'error'
 * @param {string} action - Response action: 'replace', 'insert', or 'cancel'
 * @param {Object} data - Response payload
 * @returns {import('./types').ResponseMessage}
 */
export function createResponseMessage(intentId, status, action, data) {
  return {
    type: MSG_TYPE_RESPONSE,
    version: PROTOCOL_VERSION,
    intentId,
    status,
    action,
    data: data || {}
  }
}

/**
 * Create a PANEL_ACTION intent message — a one-way command from Cozy Drive
 * (host) down to the plugin iframe. Unlike AI_TEXT_ASSISTANT, this carries
 * a direct Replace/Insert instruction and does not expect a response.
 *
 * @param {{action: 'replace'|'insert', text: string, html?: string, md?: string}} payload
 * @returns {import('./types').IntentMessage}
 */
export function createPanelActionIntent({ action, text, html, md }) {
  return createIntentMessage(
    INTENT_ACTIONS.PANEL_ACTION,
    { action: action, text: text, html: html, md: md },
    'cozy-drive-panel'
  )
}

/**
 * Validate an intent message.
 * Checks structure, required fields, types, version, and data size.
 *
 * @param {*} msg - Message to validate
 * @returns {boolean} True if valid
 */
export function validateIntent(msg) {
  if (!msg || typeof msg !== 'object') {
    console.warn('[cozy-bridge] Invalid intent: not an object')
    return false
  }
  if (msg.type !== MSG_TYPE_INTENT) {
    console.warn('[cozy-bridge] Invalid intent: wrong type:', msg.type)
    return false
  }
  if (msg.version !== PROTOCOL_VERSION) {
    console.warn(
      '[cozy-bridge] Invalid intent: unsupported version:',
      msg.version
    )
    return false
  }
  if (typeof msg.intentId !== 'string' || !msg.intentId) {
    console.warn('[cozy-bridge] Invalid intent: missing or invalid intentId')
    return false
  }
  if (typeof msg.action !== 'string' || !msg.action) {
    console.warn('[cozy-bridge] Invalid intent: missing or invalid action')
    return false
  }
  if (typeof msg.source !== 'string' || !msg.source) {
    console.warn('[cozy-bridge] Invalid intent: missing or invalid source')
    return false
  }
  if (!msg.data || typeof msg.data !== 'object') {
    console.warn('[cozy-bridge] Invalid intent: missing or invalid data')
    return false
  }

  // Size limit validation
  try {
    if (JSON.stringify(msg.data).length > MAX_DATA_SIZE) {
      console.warn(
        '[cozy-bridge] Invalid intent: data payload exceeds 1MB limit'
      )
      return false
    }
  } catch (e) {
    console.warn('[cozy-bridge] Invalid intent: data is not serializable')
    return false
  }

  return true
}

/**
 * Validate a response message.
 * Checks structure, required fields, version, and status value.
 *
 * @param {*} msg - Message to validate
 * @returns {boolean} True if valid
 */
export function validateResponse(msg) {
  if (!msg || typeof msg !== 'object') {
    console.warn('[cozy-bridge] Invalid response: not an object')
    return false
  }
  if (msg.type !== MSG_TYPE_RESPONSE) {
    console.warn('[cozy-bridge] Invalid response: wrong type:', msg.type)
    return false
  }
  if (msg.version !== PROTOCOL_VERSION) {
    console.warn(
      '[cozy-bridge] Invalid response: unsupported version:',
      msg.version
    )
    return false
  }
  if (typeof msg.intentId !== 'string' || !msg.intentId) {
    console.warn(
      '[cozy-bridge] Invalid response: missing or invalid intentId'
    )
    return false
  }
  if (msg.status !== 'ok' && msg.status !== 'error') {
    console.warn(
      '[cozy-bridge] Invalid response: status must be "ok" or "error", got:',
      msg.status
    )
    return false
  }

  // Size limit validation on data if present
  if (msg.data) {
    try {
      if (JSON.stringify(msg.data).length > MAX_DATA_SIZE) {
        console.warn(
          '[cozy-bridge] Invalid response: data payload exceeds 1MB limit'
        )
        return false
      }
    } catch (e) {
      console.warn('[cozy-bridge] Invalid response: data is not serializable')
      return false
    }
  }

  return true
}
