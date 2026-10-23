const MARKER_RULES = [
  {
    marker: '<u>',
    rule: 'Keep the <u> and </u> tags around the underlined text, and do not add any.'
  },
  {
    marker: '[^scribe-fn-',
    rule: 'Keep each [^scribe-fn-N] marker as it is, where its text stays; do not add markers or definitions.'
  },
  {
    marker: '{{REF:',
    rule: 'Keep each {{REF:scribe-ref-N:text}} marker; you may change its text, not its id.'
  },
  {
    marker: '![image ',
    rule: 'Keep each ![image N] marker where its image belongs; do not add any.'
  }
]

/**
 * The rules, for the LLM, of the markers the text holds: the plugin writes
 * back the markers an answer keeps as they are
 *
 * @param {string | undefined} content - the Markdown of the plugin
 * @returns {string | undefined} undefined without a marker: no rule
 */
export const makeRules = content => {
  if (typeof content !== 'string') return undefined
  const rules = MARKER_RULES.filter(({ marker }) =>
    content.includes(marker)
  ).map(({ rule }) => rule)
  return rules.length > 0 ? rules.join(' ') : undefined
}
