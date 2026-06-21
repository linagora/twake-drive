// EmbedPDF fetches several assets from the jsDelivr CDN at runtime (the Pdfium
// wasm, the default stamp library, glyph-fallback fonts and the UI/signature
// webfonts). Our production CSP forbids connecting to external origins, so we
// self-host everything and point EmbedPDF at same-origin paths.
//
// The files are copied into build/static by rsbuild (see rsbuild.config.mjs),
// exactly like the Excalidraw fonts. The /static route is declared public in
// manifest.webapp, so these resolve for both the logged-in app and the public
// (shared link) pages.
import { fonts as arabicFonts } from '@embedpdf/fonts-arabic'
import { fonts as hebrewFonts } from '@embedpdf/fonts-hebrew'
import { fonts as latinFonts } from '@embedpdf/fonts-latin'
import { FontCharset } from '@embedpdf/models'

// Absolute base URL for the self-hosted assets. The Pdfium engine and the glyph
// fallback run inside a `blob:` Web Worker whose base URL is the blob itself, so
// a root-relative path like `/static/...` cannot be resolved there ("Failed to
// parse URL"). Anchoring to `window.location.origin` keeps the URLs valid in the
// worker as well as on the main thread. The /static route lives on the app's own
// origin in both the logged-in and public (shared link) cases.
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''
const STATIC_BASE = `${ORIGIN}/static`

// Custom URL for the Pdfium wasm (default: jsDelivr). Passed as config.wasmUrl.
export const PDFIUM_WASM_URL = `${STATIC_BASE}/pdfium.wasm`

// Self-hosted default stamp library. `{locale}` is resolved by the stamp plugin
// against the current i18n locale and falls back to `en`, matching the upstream
// CDN behavior. Passed as config.stamp.manifests.
export const STAMP_MANIFESTS = [
  {
    url: `${STATIC_BASE}/embedpdf-stamps/{locale}/manifest.json`,
    fallbackLocale: 'en'
  }
]

const toVariants = (fonts, dir) =>
  fonts.map(f => ({
    url: `${STATIC_BASE}/embedpdf-fonts/${dir}/${f.file}`,
    weight: f.weight,
    italic: f.italic
  }))

// We only ship Regular (400) and Bold (700) of the Latin family to stay within
// the registry size budget (the full Noto Sans family is ~5 MB gzipped). rsbuild
// copies exactly these two files, so the fallback map must reference only them.
const latinFallbackFonts = latinFonts.filter(
  f => !f.italic && (f.weight === 400 || f.weight === 700)
)

// Glyph fallback used by Pdfium when a PDF embeds no font for a given script.
// We ship Latin (which also covers Cyrillic/Greek/Vietnamese), Arabic and
// Hebrew (~11 MB total, fetched lazily and only when actually needed). The CJK
// packages (~140 MB) are intentionally omitted: those charsets simply have no
// fallback entry, so Pdfium never requests them and no external call is made.
// To add CJK later, ship @embedpdf/fonts-{jp,kr,sc,tc} the same way and map the
// SHIFTJIS / HANGEUL / GB2312 / CHINESEBIG5 charsets here.
export const FONT_FALLBACK = {
  fonts: {
    [FontCharset.CYRILLIC]: toVariants(latinFallbackFonts, 'latin'),
    [FontCharset.GREEK]: toVariants(latinFallbackFonts, 'latin'),
    [FontCharset.VIETNAMESE]: toVariants(latinFallbackFonts, 'latin'),
    [FontCharset.ARABIC]: toVariants(arabicFonts, 'arabic'),
    [FontCharset.HEBREW]: toVariants(hebrewFonts, 'hebrew')
  }
}

// The snippet UI font (Open Sans) and the signature modal's cursive fonts load
// from Google Fonts by default. `null` skips the <link> entirely and falls back
// to the system font stack, keeping every request same-origin. Passed as
// config.fonts.
export const SNIPPET_FONTS = {
  ui: null,
  signature: null
}
