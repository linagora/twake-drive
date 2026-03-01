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

/** @type {string} Message type for selection state (plugin -> host) */
export const MSG_TYPE_SELECTION_STATE = 'cozy-bridge:selection-state'

/** @type {number} Maximum allowed size for message data payload (1MB) */
const MAX_DATA_SIZE = 1_000_000

/**
 * Create an intent message to be sent from a plugin to Cozy Drive.
 *
 * @param {string} action - Intent action verb, e.g. 'AI_TEXT_EDIT'
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
 * Validate a selection-state message.
 * Checks structure, required fields, types, version, and data size.
 *
 * @param {*} msg - Message to validate
 * @returns {boolean} True if valid
 */
export function validateSelectionState(msg) {
  if (!msg || typeof msg !== 'object') {
    console.warn('[cozy-bridge] Invalid selection-state: not an object')
    return false
  }
  if (msg.type !== MSG_TYPE_SELECTION_STATE) {
    console.warn(
      '[cozy-bridge] Invalid selection-state: wrong type:',
      msg.type
    )
    return false
  }
  if (msg.version !== PROTOCOL_VERSION) {
    console.warn(
      '[cozy-bridge] Invalid selection-state: unsupported version:',
      msg.version
    )
    return false
  }
  if (typeof msg.source !== 'string' || !msg.source) {
    console.warn(
      '[cozy-bridge] Invalid selection-state: missing or invalid source'
    )
    return false
  }
  if (!msg.data || typeof msg.data !== 'object') {
    console.warn(
      '[cozy-bridge] Invalid selection-state: missing or invalid data'
    )
    return false
  }
  if (typeof msg.data.hasSelection !== 'boolean') {
    console.warn(
      '[cozy-bridge] Invalid selection-state: hasSelection must be a boolean'
    )
    return false
  }
  if (msg.data.hasSelection) {
    if (typeof msg.data.text !== 'string' || !msg.data.text) {
      console.warn(
        '[cozy-bridge] Invalid selection-state: text must be a non-empty string when hasSelection is true'
      )
      return false
    }
    if (typeof msg.data.top !== 'number' || typeof msg.data.left !== 'number') {
      console.warn(
        '[cozy-bridge] Invalid selection-state: top and left must be numbers when hasSelection is true'
      )
      return false
    }
  }

  // Size limit validation
  try {
    if (JSON.stringify(msg.data).length > MAX_DATA_SIZE) {
      console.warn(
        '[cozy-bridge] Invalid selection-state: data payload exceeds 1MB limit'
      )
      return false
    }
  } catch (e) {
    console.warn(
      '[cozy-bridge] Invalid selection-state: data is not serializable'
    )
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
