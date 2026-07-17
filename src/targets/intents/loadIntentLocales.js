const FALLBACK_LOCALE = 'en'

async function loadLocale(locale) {
  // Keep intent locale modules separate from the synchronous locale context
  // used by the full app, otherwise chunk optimization merges every locale.
  const localeModule = await import(`@/locales/${locale}.json?intent`)
  return localeModule.default ?? localeModule
}

export async function loadIntentLocales(locale, loadDictionary = loadLocale) {
  const fallbackDictionaryPromise = loadDictionary(FALLBACK_LOCALE)
  if (locale === FALLBACK_LOCALE) {
    const fallbackDictionary = await fallbackDictionaryPromise
    return () => fallbackDictionary
  }

  const [fallbackDictionary, currentDictionary] = await Promise.all([
    fallbackDictionaryPromise,
    loadDictionary(locale).catch(() => null)
  ])

  return requestedLocale =>
    requestedLocale === locale
      ? (currentDictionary ?? fallbackDictionary)
      : fallbackDictionary
}
