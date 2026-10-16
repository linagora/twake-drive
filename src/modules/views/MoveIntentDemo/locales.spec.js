import Polyglot from 'node-polyglot'

import { MoveIntentDemo } from '@/locales/en.json'

it.each([
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'it',
  'ja',
  'ko',
  'nl',
  'nl_NL',
  'pl',
  'ru',
  'vi',
  'zh_CN',
  'zh_TW'
])('provides all demo messages and interpolated counts in %s', locale => {
  const dictionary = require(`@/locales/${locale}.json`).MoveIntentDemo
  expect(Object.keys(dictionary).sort()).toEqual(
    Object.keys(MoveIntentDemo).sort()
  )
  const polyglot = new Polyglot({ locale, phrases: dictionary })
  for (const key of Object.keys(MoveIntentDemo)) {
    expect(typeof dictionary[key]).toBe('string')
    expect(dictionary[key].trim()).not.toBe('')
    for (const smart_count of [0, 1, 2, 5]) {
      const message = polyglot.t(key, { smart_count })
      expect(message).not.toContain('%{')
      expect(message).not.toContain('|||')
      if (key === 'completed') expect(message).toContain(String(smart_count))
    }
  }
})
