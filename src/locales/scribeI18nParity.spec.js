// NOTE: locale JSON imports are namespaced (`localeXx`) so that the Italian
// import does not shadow Jest's global `it` test function.
import localeDe from './de.json'
import localeEn from './en.json'
import localeEs from './es.json'
import localeFr from './fr.json'
import localeIt from './it.json'

/**
 * Scribe i18n parity gate (I18N-01).
 *
 * Locks ROADMAP v3.1-07 criterion 1: the `Scribe.*` key set must be identical
 * across the 5 target locales (fr/en/de/es/it) and every leaf value must be a
 * non-empty trimmed string. Any future key added to one locale but not mirrored
 * to the others fails here, naming the locale and the exact missing/extra keys.
 *
 * Scope is deliberately the 5 target locales only — the non-target locales
 * (ar/ja/ko/nl/nl_NL/pl/ru/vi/zh_*) are out of scope per the phase CONTEXT and
 * would falsely fail this gate.
 */

// Flatten the Scribe namespace into a sorted list of dotted leaf keys.
// Only string leaves are returned (objects are recursed into).
const flattenScribe = locale => {
  const root = (locale && locale.Scribe) || {}
  const walk = (obj, prefix) => {
    const out = []
    Object.keys(obj).forEach(k => {
      const value = obj[k]
      const dotted = prefix ? `${prefix}.${k}` : k
      if (value && typeof value === 'object') {
        out.push(...walk(value, dotted))
      } else {
        out.push(dotted)
      }
    })
    return out
  }
  return walk(root, '').sort()
}

// Symmetric difference helper for self-explaining failure messages.
const symmetricDiff = (expected, actual) => {
  const expectedSet = new Set(expected)
  const actualSet = new Set(actual)
  const missing = expected.filter(k => !actualSet.has(k)) // in fr, not in locale
  const extra = actual.filter(k => !expectedSet.has(k)) // in locale, not in fr
  return { missing, extra }
}

const LOCALES = {
  fr: localeFr,
  en: localeEn,
  de: localeDe,
  es: localeEs,
  it: localeIt
}

describe('Scribe i18n parity', () => {
  const reference = flattenScribe(localeFr)

  describe('flattened Scribe.* key set equals the fr reference', () => {
    const others = ['en', 'de', 'es', 'it']

    others.forEach(name => {
      it(`${name} has the same Scribe.* key set as fr`, () => {
        const localeKeys = flattenScribe(LOCALES[name])
        const { missing, extra } = symmetricDiff(reference, localeKeys)

        // Assert on the named diffs first so a failure prints the exact
        // missing/extra keys for this locale (self-explaining drift report).
        expect({ locale: name, missing, extra }).toEqual({
          locale: name,
          missing: [],
          extra: []
        })
        // Final guard: deep-equal the sorted arrays.
        expect(localeKeys).toEqual(reference)
      })
    })
  })

  describe('every Scribe.* leaf value is a non-empty trimmed string', () => {
    Object.keys(LOCALES).forEach(name => {
      it(`${name} has no empty Scribe.* values`, () => {
        const root = LOCALES[name].Scribe
        const empties = []
        const walk = (obj, prefix) => {
          Object.keys(obj).forEach(k => {
            const value = obj[k]
            const dotted = prefix ? `${prefix}.${k}` : k
            if (value && typeof value === 'object') {
              walk(value, dotted)
            } else if (typeof value !== 'string' || value.trim() === '') {
              empties.push(dotted)
            }
          })
        }
        walk(root, '')

        // On failure this prints the locale + the offending key paths.
        expect({ locale: name, empties }).toEqual({ locale: name, empties: [] })
      })
    })
  })
})
