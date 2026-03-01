/**
 * Mock text transformation for Scribe actions.
 *
 * Per MOCK-01 requirement: prefix each line with '$ ' and add
 * action-specific wrapping to produce visibly different output
 * per action type.
 *
 * Instant transformation (no simulated delay) per research recommendation.
 *
 * @param {string} actionId - The action identifier from scribeActions.js
 * @param {string} text - The selected text to transform
 * @returns {string} The mock-transformed text
 */

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

export function mockTransform(actionId, text) {
  const lines = text.split('\n')
  const prefixed = lines.map(l => MOCK_PREFIX + l).join('\n')

  switch (actionId) {
    // Grammar correction: capitalize first letter of each line
    case 'correct-grammar':
      return lines.map(l => MOCK_PREFIX + capitalize(l)).join('\n')

    // Translate: wrap with language markers
    case 'translate-francais':
      return `[FR] Traduction:\n${prefixed}\n[/FR]`
    case 'translate-anglais':
      return `[EN] Translation:\n${prefixed}\n[/EN]`
    case 'translate-russe':
      return `[RU] \u041F\u0435\u0440\u0435\u0432\u043E\u0434:\n${prefixed}\n[/RU]`
    case 'translate-vietnamien':
      return `[VI] B\u1EA3n d\u1ECBch:\n${prefixed}\n[/VI]`

    // Tone changes
    case 'tone-professional':
      return `Dear Sir/Madam,\n${prefixed}\nBest regards.`
    case 'tone-casual':
      return `Hey!\n${prefixed}\nCheers!`
    case 'tone-polite':
      return `If I may,\n${prefixed}\nThank you kindly.`

    // Improve
    case 'improve-shorter':
      return lines
        .map(l => {
          const words = l.split(' ')
          return (
            MOCK_PREFIX +
            words.slice(0, Math.ceil(words.length / 2)).join(' ')
          )
        })
        .join('\n')
    case 'improve-expand':
      return lines
        .map(
          l =>
            MOCK_PREFIX + l + ' (expanded with additional context and detail)'
        )
        .join('\n')
    case 'improve-emojify':
      return lines.map(l => MOCK_PREFIX + '\u2728 ' + l + ' \uD83C\uDF89').join('\n')
    case 'improve-bullets':
      return lines.map(l => MOCK_PREFIX + '\u2022 ' + l.trim()).join('\n')

    // Free prompt
    case 'free-prompt':
      return `[Custom: applied]\n${prefixed}\n[/Custom]`

    // Default fallback (MOCK-01 spec)
    default:
      return `[Mock transform]\n${prefixed}\n[/Mock transform]`
  }
}
