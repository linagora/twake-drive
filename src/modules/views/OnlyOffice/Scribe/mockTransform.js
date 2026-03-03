/**
 * Mock text transformation for Scribe actions.
 *
 * Config-driven: reads mockResult instructions from SCRIBE_ACTIONS
 * instead of using a hardcoded switch/case. Adding a new action to
 * scribeActions.js automatically makes it work here.
 *
 * Per MOCK-01 requirement: prefix each line with '$ ' and add
 * action-specific wrapping to produce visibly different output
 * per action type.
 *
 * Instant transformation (no simulated delay) per research recommendation.
 *
 * @param {string} actionId - The action identifier from scribeActions.js
 * @param {string} text - The selected text to transform
 * @param {Object} [extra] - Extra data (e.g. { language: 'Spanish' } for translate-custom)
 * @returns {string} The mock-transformed text
 */

import { SCRIBE_ACTIONS, FREE_PROMPT_CONFIG, buildTranslateChildren } from '@/modules/views/OnlyOffice/Scribe/scribeActions'

const MOCK_PREFIX = '$ '

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Search SCRIBE_ACTIONS (including children and dynamic translate children)
 * for an action matching the given id.
 *
 * @param {string} actionId
 * @returns {Object|null} The action config object, or null if not found
 */
function findActionConfig(actionId) {
  if (actionId === 'free-prompt') {
    return FREE_PROMPT_CONFIG
  }

  for (const action of SCRIBE_ACTIONS) {
    if (action.id === actionId) {
      return action
    }
    if (action.children) {
      for (const child of action.children) {
        if (child.id === actionId) {
          return child
        }
      }
    }
  }

  // Check dynamic translate children (they are not in the static SCRIBE_ACTIONS)
  if (actionId.startsWith('translate-')) {
    const translateChildren = buildTranslateChildren('')
    for (const child of translateChildren) {
      if (child.id === actionId) {
        return child
      }
    }
  }

  return null
}

/**
 * Interpret a mockResult string from the action config and apply
 * the corresponding transformation to the text.
 *
 * Supported mockResult values:
 * - 'capitalize': capitalize first letter of each line, prefix with $
 * - 'wrap:before:after': wrap prefixed text with before/after strings
 * - 'truncate-half': take first half of words per line, prefix with $
 * - 'suffix: text': append text after each $ -prefixed line
 * - 'emojify': prefix each line with $ + sparkles, suffix with party
 * - 'bullets': prefix each line with $ + bullet character
 * - null or unrecognized: default [Mock transform] wrapper
 *
 * @param {string|null} mockResult - The mockResult instruction from config
 * @param {string} text - The selected text to transform
 * @param {Object} [extra] - Extra data for placeholder substitution
 * @returns {string} The mock-transformed text
 */
function applyMockResult(mockResult, text, extra) {
  const lines = text.split('\n')
  const prefixed = lines.map(l => MOCK_PREFIX + l).join('\n')

  if (!mockResult) {
    return `[Mock transform]\n${prefixed}\n[/Mock transform]`
  }

  // Replace {language} placeholders if extra.language is provided
  let result = mockResult
  if (extra && extra.language) {
    result = result.replace(/\{language\}/g, extra.language)
  }

  if (result === 'capitalize') {
    return lines.map(l => MOCK_PREFIX + capitalize(l)).join('\n')
  }

  if (result === 'truncate-half') {
    return lines
      .map(l => {
        const words = l.split(' ')
        return MOCK_PREFIX + words.slice(0, Math.ceil(words.length / 2)).join(' ')
      })
      .join('\n')
  }

  if (result === 'emojify') {
    return lines.map(l => MOCK_PREFIX + '\u2728 ' + l + ' \uD83C\uDF89').join('\n')
  }

  if (result === 'bullets') {
    return lines.map(l => MOCK_PREFIX + '\u2022 ' + l.trim()).join('\n')
  }

  if (result.startsWith('suffix:')) {
    const suffixText = result.slice('suffix:'.length)
    return lines.map(l => MOCK_PREFIX + l + suffixText).join('\n')
  }

  if (result.startsWith('wrap:')) {
    const parts = result.slice('wrap:'.length).split(':')
    const before = parts[0] || ''
    const after = parts.slice(1).join(':') || ''
    return `${before}\n${prefixed}\n${after}`
  }

  // Unrecognized mockResult: fallback
  return `[Mock transform]\n${prefixed}\n[/Mock transform]`
}

/**
 * Mock text transformation driven by SCRIBE_ACTIONS config.
 *
 * @param {string} actionId - The action identifier from scribeActions.js
 * @param {string} text - The selected text to transform
 * @param {Object} [extra] - Extra data (e.g. { language: 'Spanish' } for translate-custom)
 * @returns {string} The mock-transformed text
 */
export function mockTransform(actionId, text, extra) {
  const config = findActionConfig(actionId)

  if (!config) {
    const lines = text.split('\n')
    const prefixed = lines.map(l => MOCK_PREFIX + l).join('\n')
    return `[Mock transform]\n${prefixed}\n[/Mock transform]`
  }

  return applyMockResult(config.mockResult, text, extra)
}
