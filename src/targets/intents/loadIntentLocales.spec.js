import { initTranslation } from 'twake-i18n'

import { loadIntentLocales } from './loadIntentLocales'

const supportedLocales = [
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
]

const dictionaries = {
  en: { greeting: 'Hello' },
  fr: { greeting: 'Bonjour' }
}

function makeLocaleLoader() {
  return jest.fn(locale => Promise.resolve(dictionaries[locale]))
}

describe('loadIntentLocales', () => {
  it('loads only the current locale and the English fallback', async () => {
    const loadLocale = makeLocaleLoader()

    const requireLocale = await loadIntentLocales('fr', loadLocale)

    expect(loadLocale).toHaveBeenCalledTimes(2)
    expect(loadLocale).toHaveBeenNthCalledWith(1, 'en')
    expect(loadLocale).toHaveBeenNthCalledWith(2, 'fr')
    expect(requireLocale('fr')).toEqual(dictionaries.fr)
    expect(requireLocale('en')).toEqual(dictionaries.en)
  })

  it.each(supportedLocales)(
    'renders the %s locale with English fallback',
    async locale => {
      const loadLocale = localeCode =>
        Promise.resolve(require(`@/locales/${localeCode}.json`))
      const requireLocale = await loadIntentLocales(locale, loadLocale)
      const translation = initTranslation(locale, requireLocale)

      expect(translation.t('Nav.item_drive')).not.toBe('Nav.item_drive')
    }
  )

  it('uses English when the current locale cannot be loaded', async () => {
    const loadLocale = jest.fn(locale =>
      locale === 'en'
        ? Promise.resolve(dictionaries.en)
        : Promise.reject(new Error('locale unavailable'))
    )

    const requireLocale = await loadIntentLocales('fr', loadLocale)

    expect(requireLocale('fr')).toEqual(dictionaries.en)
  })

  it('loads English only once when it is the current locale', async () => {
    const loadLocale = makeLocaleLoader()

    const requireLocale = await loadIntentLocales('en', loadLocale)

    expect(loadLocale).toHaveBeenCalledTimes(1)
    expect(loadLocale).toHaveBeenCalledWith('en')
    expect(requireLocale('en')).toEqual(dictionaries.en)
  })
})
