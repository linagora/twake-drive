// The @embedpdf font/model packages ship as ESM and are excluded from the jest
// transform (see transformIgnorePatterns), so we mock them with the minimal
// shape pdfAssets.js needs.
jest.mock('@embedpdf/fonts-latin', () => ({
  fonts: [
    { file: 'NotoSans-Regular.ttf', weight: 400 },
    { file: 'NotoSans-Bold.ttf', weight: 700 },
    { file: 'NotoSans-Italic.ttf', weight: 400, italic: true }
  ]
}))
jest.mock('@embedpdf/fonts-arabic', () => ({
  fonts: [{ file: 'NotoNaskhArabic-Regular.ttf', weight: 400 }]
}))
jest.mock('@embedpdf/fonts-hebrew', () => ({
  fonts: [{ file: 'NotoSansHebrew-Regular.ttf', weight: 400 }]
}))
jest.mock('@embedpdf/models', () => ({
  FontCharset: {
    CYRILLIC: 204,
    GREEK: 161,
    VIETNAMESE: 163,
    ARABIC: 178,
    HEBREW: 177
  }
}))

const {
  PDFIUM_WASM_URL,
  STAMP_MANIFESTS,
  FONT_FALLBACK
} = require('@/modules/views/Pdf/pdfAssets')

// The Pdfium engine and glyph fallback fetch these URLs from inside a blob: Web
// Worker, where root-relative paths cannot be resolved. Every asset URL must be
// absolute (anchored to the page origin), otherwise the editor hangs forever on
// "Initializing plugins". jsdom serves the test page from http://cozy.localhost:8080.
const isAbsolute = url => /^https?:\/\//.test(url)

describe('pdfAssets', () => {
  it('exposes an absolute Pdfium wasm URL', () => {
    expect(isAbsolute(PDFIUM_WASM_URL)).toBe(true)
    expect(PDFIUM_WASM_URL).toBe(`${window.location.origin}/static/pdfium.wasm`)
  })

  it('exposes an absolute stamp manifest URL', () => {
    expect(isAbsolute(STAMP_MANIFESTS[0].url)).toBe(true)
  })

  it('exposes absolute glyph-fallback font URLs', () => {
    const urls = Object.values(FONT_FALLBACK.fonts)
      .flat()
      .map(variant => variant.url)
    expect(urls.length).toBeGreaterThan(0)
    urls.forEach(url => expect(isAbsolute(url)).toBe(true))
  })
})
