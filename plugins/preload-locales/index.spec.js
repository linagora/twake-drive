import { addLocalePreloads } from './index.mjs'

const html = '<html lang="{{.Locale}}"><head></head><body></body></html>'
const namedChunks = new Map([
  ['main', { files: new Set(['static/js/main.1a.js']) }],
  [
    'locale-en-json',
    { files: new Set(['static/js/async/locale-en-json.2b.js']) }
  ],
  [
    'locale-fr-json',
    { files: new Set(['static/js/async/locale-fr-json.3c.js']) }
  ],
  [
    'locale-ja-json',
    { files: new Set(['static/js/async/locale-ja-json.4d.js']) }
  ]
])

// cozy-flagship-app serves index.html itself and only substitutes the literal
// `{{.Key}}` placeholders (src/libs/httpserver/indexGenerator.ts).
const renderLikeFlagship = (template, values) =>
  Object.entries(values).reduce(
    (output, [key, value]) => output.split(`{{.${key}}}`).join(value),
    template
  )

const parse = source => new DOMParser().parseFromString(source, 'text/html')

describe('addLocalePreloads', () => {
  const output = addLocalePreloads(html, { namedChunks, publicPath: '/' })

  it('shows no template text when served by the flagship app', () => {
    const doc = parse(renderLikeFlagship(output, { Locale: 'fr' }))

    expect(doc.body.textContent).not.toContain('{{')
    expect(doc.head.textContent).not.toContain('{{')
  })

  it('preloads English unconditionally', () => {
    const doc = parse(renderLikeFlagship(output, { Locale: 'fr' }))

    expect(
      doc.querySelector(
        'link[rel="preload"][href="/static/js/async/locale-en-json.2b.js"]'
      )
    ).not.toBeNull()
  })

  it('only lets cozy-stack turn on the instance locale preload', () => {
    expect(output).toContain(
      '<link rel="{{if eq .Locale `fr`}}preload{{end}}" as="script" href="/static/js/async/locale-fr-json.3c.js" />'
    )
    const doc = parse(renderLikeFlagship(output, { Locale: 'fr' }))
    expect(doc.querySelectorAll('link[rel="preload"]')).toHaveLength(1)
  })
})
