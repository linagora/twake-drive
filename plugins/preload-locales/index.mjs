// src/locales/index.js loads the current locale and the English fallback as
// async chunks once the main bundle runs, a round trip before the first
// render. cozy-stack renders index.html as a Go template, so preload English
// and, through `{{if eq .Locale}}`, the instance locale while the main bundle
// downloads. On the public page, anonymous visitors use their browser locale,
// so for them the instance locale preload can be unused.
// cozy-flagship-app serves index.html itself and only substitutes `{{.Key}}`:
// the condition stays inside the rel attribute so that, left unrendered, it
// gives an inert link instead of visible text. Backquotes keep the attribute
// quotes balanced.
export const addLocalePreloads = (html, { namedChunks, publicPath }) => {
  const preloads = []
  for (const [name, chunk] of namedChunks) {
    const locale = name.match(/^locale-(.+)-json$/)?.[1]
    if (!locale) continue
    const rel =
      locale === 'en'
        ? 'preload'
        : `{{if eq .Locale \`${locale}\`}}preload{{end}}`
    for (const file of chunk.files) {
      if (!file.endsWith('.js')) continue
      preloads.push(
        `<link rel="${rel}" as="script" href="${publicPath}${file}" />`
      )
    }
  }
  return html.replace('</head>', `${preloads.join('\n')}\n</head>`)
}

export const preloadLocalesPlugin = {
  name: 'preload-locales',
  setup(api) {
    api.modifyHTML((html, { compilation }) =>
      addLocalePreloads(html, {
        namedChunks: compilation.namedChunks,
        publicPath: compilation.outputOptions.publicPath
      })
    )
  }
}
