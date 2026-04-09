import { getBrowserLocale, getPublicPageLocale } from './localeHelper'

describe('getBrowserLocale', () => {
  const originalNavigator = { ...navigator }

  const mockLanguages = (languages, language) => {
    Object.defineProperty(navigator, 'languages', {
      value: languages,
      configurable: true
    })
    Object.defineProperty(navigator, 'language', {
      value: language ?? (languages?.[0] || 'en'),
      configurable: true
    })
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'languages', {
      value: originalNavigator.languages,
      configurable: true
    })
    Object.defineProperty(navigator, 'language', {
      value: originalNavigator.language,
      configurable: true
    })
  })

  it('returns an exact match', () => {
    mockLanguages(['fr'])
    expect(getBrowserLocale()).toBe('fr')
  })

  it('normalizes BCP 47 hyphens to underscores', () => {
    mockLanguages(['zh-CN'])
    expect(getBrowserLocale()).toBe('zh_CN')
  })

  it('falls back to the primary subtag when the full tag is unsupported', () => {
    mockLanguages(['fr-CA'])
    expect(getBrowserLocale()).toBe('fr')
  })

  it('returns the first supported language from the preference list', () => {
    mockLanguages(['sv', 'de', 'fr'])
    expect(getBrowserLocale()).toBe('de')
  })

  it('falls back to en when no language matches', () => {
    mockLanguages(['xx', 'yy'])
    expect(getBrowserLocale()).toBe('en')
  })

  it('uses navigator.language when navigator.languages is undefined', () => {
    mockLanguages(undefined, 'ja')
    expect(getBrowserLocale()).toBe('ja')
  })

  it('falls back to en when both navigator.languages and navigator.language are undefined', () => {
    mockLanguages(undefined, undefined)
    expect(getBrowserLocale()).toBe('en')
  })
})

describe('getPublicPageLocale', () => {
  const originalNavigator = { ...navigator }

  const mockLanguages = languages => {
    Object.defineProperty(navigator, 'languages', {
      value: languages,
      configurable: true
    })
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'languages', {
      value: originalNavigator.languages,
      configurable: true
    })
  })

  it('uses browser locale when isLoggedIn is false', () => {
    mockLanguages(['es'])
    expect(getPublicPageLocale({ isLoggedIn: false, locale: 'fr' })).toBe('es')
  })

  it('uses instance locale when isLoggedIn is true', () => {
    expect(getPublicPageLocale({ isLoggedIn: true, locale: 'fr' })).toBe('fr')
  })

  it('uses instance locale when isLoggedIn is absent (backward compat)', () => {
    expect(getPublicPageLocale({ locale: 'de' })).toBe('de')
  })

  it('falls back to en when isLoggedIn is absent and locale is missing', () => {
    expect(getPublicPageLocale({})).toBe('en')
  })
})
