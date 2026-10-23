import { makeRules } from '@/modules/views/OnlyOffice/Scribe/rules'

const UNDERLINE =
  'Keep the <u> and </u> tags around the underlined text, and do not add any.'
const NOTE =
  'Keep each [^scribe-fn-N] marker as it is, where its text stays; do not add markers or definitions.'
const REFERENCE =
  'Keep each {{REF:scribe-ref-N:text}} marker; you may change its text, not its id.'
const IMAGE =
  'Keep each ![image N] marker where its image belongs; do not add any.'

describe('makeRules', () => {
  it('gives no rule for a plain text', () => {
    expect(makeRules('Un **texte** et une [image](https://a.org/b.png)')).toBe(
      undefined
    )
    expect(makeRules('')).toBe(undefined)
    expect(makeRules(undefined)).toBe(undefined)
  })

  it('gives the rule of each marker the text holds', () => {
    expect(makeRules('![image 1] et du texte <u>souligné</u>')).toBe(
      `${UNDERLINE} ${IMAGE}`
    )
    expect(
      makeRules(
        'Voir {{REF:scribe-ref-1:Titre}}[^scribe-fn-1] <u>là</u> ![image 2]'
      )
    ).toBe(`${UNDERLINE} ${NOTE} ${REFERENCE} ${IMAGE}`)
  })
})
