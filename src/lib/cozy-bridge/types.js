/**
 * cozy-bridge type definitions
 *
 * Intent-based communication protocol between OnlyOffice plugins
 * and Cozy Drive, inspired by Android intents and Cozy's intent system.
 *
 * @see https://docs.cozy.io/en/cozy-stack/intents/
 */

/**
 * Intent message sent from a plugin to Cozy Drive (host).
 *
 * @typedef {Object} IntentMessage
 * @property {string} type - Always 'cozy-bridge:intent'
 * @property {number} version - Protocol version, always 1
 * @property {string} intentId - Unique correlation ID (UUID)
 * @property {string} action - Intent action verb, e.g. 'AI_TEXT_ASSISTANT'
 * @property {string} source - Sender identity, e.g. 'onlyoffice-plugin'
 * @property {Object} data - Intent payload (action-specific)
 */

/**
 * Response message sent from Cozy Drive (host) back to the plugin.
 *
 * @typedef {Object} ResponseMessage
 * @property {string} type - Always 'cozy-bridge:response'
 * @property {number} version - Protocol version, always 1
 * @property {string} intentId - Correlation ID matching the original intent
 * @property {string} status - 'ok' or 'error'
 * @property {string} action - Response action: 'replace', 'insert', or 'cancel'
 * @property {Object} data - Response payload (action-specific)
 */

export default {}
