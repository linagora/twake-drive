import { locales } from '@/locales'

const supportedLocales = new Set(Object.keys(locales))

/**
 * Returns the best matching supported locale from the browser's language
 * preferences. Iterates through `navigator.languages` (or `navigator.language`
 * as a fallback), normalizing BCP 47 tags (e.g. `zh-CN` → `zh_CN`) and
 * trying the primary subtag (e.g. `fr` from `fr-CA`) before moving on.
 *
 * @returns {string} A supported locale key (e.g. `'fr'`, `'zh_CN'`), or `'en'`
 *   if no browser language matches.
 */
export const getBrowserLocale = () => {
  const languages = navigator.languages ?? [navigator.language || 'en']

  for (const language of languages) {
    // BCP 47 uses hyphens (zh-CN) but our locale keys use underscores (zh_CN)
    const normalized = language.replaceAll('-', '_')
    if (supportedLocales.has(normalized)) {
      return normalized
    }
    const primary = normalized.split('_')[0]
    if (supportedLocales.has(primary)) {
      return primary
    }
  }

  return 'en'
}

/**
 * Determines the locale for the public sharing page.
 *
 * When `isLoggedIn` is `false`, the visitor is anonymous so the browser locale
 * is used. When `isLoggedIn` is `true` or absent (cozy-stack < PR#4719), the
 * instance locale from the dataset is used for backward compatibility.
 *
 * @param {object} dataset - The parsed `data-cozy` dataset from the DOM root.
 * @param {boolean} [dataset.isLoggedIn] - Whether the current user is
 *   authenticated. Absent on older cozy-stack versions.
 * @param {string} [dataset.locale] - The Cozy instance locale (e.g. `'fr'`).
 * @returns {string} The resolved locale key to use for translations.
 */
export const getPublicPageLocale = dataset =>
  'isLoggedIn' in dataset && !dataset.isLoggedIn
    ? getBrowserLocale()
    : dataset.locale || 'en'
