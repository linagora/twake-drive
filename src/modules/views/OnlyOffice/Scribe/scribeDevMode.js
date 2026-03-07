/**
 * Scribe Dev MD Mode
 *
 * Toggle from browser console:
 *   localStorage.setItem('SCRIBE_DEV_MD', 'true')   // enable
 *   localStorage.setItem('SCRIBE_DEV_MD', 'false')  // disable
 *
 * When enabled:
 * - "Test MD" button appears in the action menu (bypasses LLM)
 * - Result panel shows 3 columns: prettified HTML | MD source | MD rendered
 *
 * highlight.js is loaded via dynamic import() — separate async chunk,
 * only fetched when dev mode is active (zero production cost).
 */

export function isScribeDevMd() {
  try {
    return (
      typeof window !== 'undefined' &&
      localStorage.getItem('SCRIBE_DEV_MD') === 'true'
    )
  } catch {
    return false
  }
}

// Cache for lazy-loaded js-beautify
var _beautifyPromise = null

/**
 * Lazily load js-beautify HTML formatter.
 * Same __webpack_public_path__ trick as highlight.js.
 */
export function loadBeautify() {
  if (_beautifyPromise) return _beautifyPromise

  // eslint-disable-next-line camelcase, no-undef
  var saved = typeof __webpack_public_path__ !== 'undefined' ? __webpack_public_path__ : undefined
  if (saved) {
    // eslint-disable-next-line camelcase, no-undef
    __webpack_public_path__ = '/'
  }

  _beautifyPromise = import(/* webpackChunkName: "beautify-dev" */ 'js-beautify/js/lib/beautify-html')
    .then(function (mod) {
      if (saved) {
        // eslint-disable-next-line camelcase, no-undef
        __webpack_public_path__ = saved
      }
      return mod.default || mod
    })
    .catch(function (err) {
      if (saved) {
        // eslint-disable-next-line camelcase, no-undef
        __webpack_public_path__ = saved
      }
      throw err
    })

  return _beautifyPromise
}

// Cache for lazy-loaded highlight.js instance
var _hljsPromise = null

/**
 * Lazily load highlight.js with XML and Markdown languages.
 *
 * In dev, cozy's setPublicPath.js overrides __webpack_public_path__ to
 * localhost:3000 for HMR. This causes dynamic import() to fetch chunks
 * from the wrong host. We temporarily restore the correct origin-relative
 * public path for our chunk load, then put back the HMR path.
 */
export function loadHighlightJs() {
  if (_hljsPromise) return _hljsPromise

  // eslint-disable-next-line camelcase, no-undef
  var savedPublicPath = typeof __webpack_public_path__ !== 'undefined' ? __webpack_public_path__ : undefined

  // Point chunk loading at the actual page origin
  if (typeof window !== 'undefined' && savedPublicPath) {
    // eslint-disable-next-line camelcase, no-undef
    __webpack_public_path__ = '/'
  }

  _hljsPromise = Promise.all([
    import(/* webpackChunkName: "hljs-dev" */ 'highlight.js/lib/core'),
    import(/* webpackChunkName: "hljs-dev" */ 'highlight.js/lib/languages/xml'),
    import(/* webpackChunkName: "hljs-dev" */ 'highlight.js/lib/languages/markdown')
  ]).then(function (modules) {
    // Restore original public path for HMR
    if (savedPublicPath) {
      // eslint-disable-next-line camelcase, no-undef
      __webpack_public_path__ = savedPublicPath
    }

    var hljs = modules[0].default || modules[0]
    hljs.registerLanguage('xml', modules[1].default || modules[1])
    hljs.registerLanguage('markdown', modules[2].default || modules[2])

    // Inject VS2015-inspired theme CSS
    if (!document.getElementById('hljs-dev-css')) {
      var style = document.createElement('style')
      style.id = 'hljs-dev-css'
      style.textContent = [
        '.hljs{background:#1e1e1e;color:#dcdcdc}',
        '.hljs-tag{color:#569cd6}',
        '.hljs-name{color:#569cd6}',
        '.hljs-attr{color:#9cdcfe}',
        '.hljs-string{color:#ce9178}',
        '.hljs-number{color:#b5cea8}',
        '.hljs-keyword{color:#569cd6}',
        '.hljs-comment{color:#6a9955;font-style:italic}',
        '.hljs-attribute{color:#9cdcfe}',
        '.hljs-section{color:#569cd6;font-weight:bold}',
        '.hljs-bullet{color:#6a9955}',
        '.hljs-emphasis{font-style:italic;color:#ce9178}',
        '.hljs-strong{font-weight:bold;color:#ce9178}',
        '.hljs-link{color:#4ec9b0}',
        '.hljs-title{color:#dcdcaa}',
        '.hljs-symbol{color:#6a9955}'
      ].join('\n')
      document.head.appendChild(style)
    }

    return hljs
  }).catch(function (err) {
    // Restore on error too
    if (savedPublicPath) {
      // eslint-disable-next-line camelcase, no-undef
      __webpack_public_path__ = savedPublicPath
    }
    throw err
  })

  return _hljsPromise
}
