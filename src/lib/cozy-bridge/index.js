/**
 * CozyBridge -- host-side message bridge for intent-based communication.
 *
 * Listens for intent messages from plugin iframes via postMessage,
 * validates origins, routes intents to registered handlers, and
 * sends responses back through the original event source.
 *
 * Usage:
 *   const bridge = new CozyBridge(['https://drive.cozy.localhost'])
 *   bridge.onIntent('AI_TEXT_EDIT', (intent, respond) => {
 *     // Process intent...
 *     respond({ status: 'ok', action: 'replace', data: { text: 'new text' } })
 *   })
 *   // On cleanup:
 *   bridge.destroy()
 *
 * @module cozy-bridge
 */

import {
  MSG_TYPE_INTENT,
  MSG_TYPE_SELECTION_STATE,
  PROTOCOL_VERSION,
  validateIntent,
  validateSelectionState,
  createResponseMessage
} from './protocol'

export class CozyBridge {
  /**
   * Create a new CozyBridge instance.
   *
   * @param {string[]} allowedOrigins - List of origins from which to accept messages.
   *   Messages from any other origin are silently ignored (with a console warning).
   */
  constructor(allowedOrigins) {
    /** @type {string[]} */
    this.allowedOrigins = allowedOrigins || []

    /** @type {Map<string, Function>} Action -> handler mapping */
    this.handlers = new Map()

    /** @private */
    this._listener = this._onMessage.bind(this)
    window.addEventListener('message', this._listener)
  }

  /**
   * Register a handler for a specific intent action.
   *
   * The handler receives the intent message and a respond function.
   * Call respond({ status, action, data }) to send a response back
   * to the plugin that cast the intent.
   *
   * @param {string} action - Intent action verb to handle, e.g. 'AI_TEXT_EDIT'
   * @param {Function} handler - Handler function: (intentMessage, respondFn) => void
   */
  onIntent(action, handler) {
    this.handlers.set(action, handler)
  }

  /**
   * Register a handler for selection state updates from the plugin.
   *
   * @param {Function} handler - (selectionData) => void
   *   selectionData: { hasSelection: boolean, text: string, top: number, left: number }
   */
  onSelectionState(handler) {
    this._selectionStateHandler = handler
  }

  /**
   * Remove handler for a specific intent action.
   *
   * @param {string} action - Intent action verb to unregister
   */
  offIntent(action) {
    this.handlers.delete(action)
  }

  /**
   * Internal message event handler.
   * Validates origin, message format, and routes to registered handlers.
   *
   * @private
   * @param {MessageEvent} event
   */
  _onMessage(event) {
    // 1. Origin validation (skip if wildcard '*' is in allowedOrigins)
    if (
      !this.allowedOrigins.includes('*') &&
      !this.allowedOrigins.includes(event.origin)
    ) {
      // Only warn if the message looks like it could be a cozy-bridge message
      const msg = event.data
      if (
        msg &&
        typeof msg === 'object' &&
        typeof msg.type === 'string' &&
        msg.type.startsWith('cozy-bridge:')
      ) {
        console.warn(
          '[cozy-bridge] Ignored message from unknown origin:',
          event.origin
        )
      }
      return
    }

    const msg = event.data

    // 2a. Check for selection-state messages (fire-and-forget, no response)
    if (
      msg &&
      msg.type === MSG_TYPE_SELECTION_STATE &&
      msg.version === PROTOCOL_VERSION
    ) {
      if (validateSelectionState(msg) && this._selectionStateHandler) {
        this._selectionStateHandler(msg.data)
      }
      return
    }

    // 2b. Check message type and version for intents
    if (!msg || msg.type !== MSG_TYPE_INTENT || msg.version !== PROTOCOL_VERSION)
      return

    // 3. Validate intent schema
    if (!validateIntent(msg)) return

    // 4. Look up handler
    const handler = this.handlers.get(msg.action)
    if (!handler) {
      console.warn(
        '[cozy-bridge] No handler registered for action:',
        msg.action
      )
      return
    }

    // 5. Store event source and origin for response routing
    const source = event.source
    const origin = event.origin

    // 6. Create respond function
    const respond = ({ status, action, data }) => {
      if (!source) {
        console.error(
          '[cozy-bridge] Cannot respond: event.source is null'
        )
        return
      }
      const response = createResponseMessage(msg.intentId, status, action, data)
      source.postMessage(response, origin)
    }

    // 7. Call handler
    handler(msg, respond)
  }

  /**
   * Remove the message event listener and clean up.
   * Call this when the bridge is no longer needed (e.g., component unmount).
   */
  destroy() {
    window.removeEventListener('message', this._listener)
    this.handlers.clear()
    this._selectionStateHandler = null
  }
}
