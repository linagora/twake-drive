import { getI18n } from 'twake-i18n'

const FALLBACK_LOCALE = 'en'

export const supportedLocales = [
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

// Each locale is its own async chunk: never require a locale file
// synchronously, or every locale ends up in the initial bundle again.
async function importLocale(locale) {
  const localeModule = await import(`./${locale}.json`)
  return localeModule.default ?? localeModule
}

let loadedDictRequire = () => ({})

/**
 * Loads the current locale and the English fallback.
 *
 * @param {string} locale - The locale to load (e.g. `'fr'`).
 * @param {Function} [loadDictionary] - Loads one locale dictionary.
 * @returns {Promise<Function>} A synchronous `dictRequire` for twake-i18n.
 */
export async function loadLocales(locale, loadDictionary = importLocale) {
  const fallbackDictionaryPromise = loadDictionary(FALLBACK_LOCALE)
  if (locale === FALLBACK_LOCALE) {
    const fallbackDictionary = await fallbackDictionaryPromise
    loadedDictRequire = () => fallbackDictionary
    return loadedDictRequire
  }

  const [fallbackDictionary, currentDictionary] = await Promise.all([
    fallbackDictionaryPromise,
    loadDictionary(locale).catch(() => null)
  ])

  loadedDictRequire = requestedLocale =>
    requestedLocale === locale
      ? (currentDictionary ?? fallbackDictionary)
      : fallbackDictionary
  return loadedDictRequire
}

export const getDriveI18n = () => getI18n(undefined, loadedDictRequire)
