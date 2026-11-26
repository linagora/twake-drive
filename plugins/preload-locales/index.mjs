// src/locales/index.js loads the current locale and the English fallback as
// async chunks once the main bundle runs, a round trip before the first
// render. cozy-stack renders index.html as a Go template, so preload English
// and, through `{{if eq .Locale}}`, the instance locale while the main bundle
// downloads. On the public page, anonymous visitors use their browser locale,
// so for them the instance locale preload can be unused.
export const addLocalePreloads = (html, { namedChunks, publicPath }) => {
  const preloads = []
  for (const [name, chunk] of namedChunks) {
    const locale = name.match(/^locale-(.+)-json$/)?.[1]
    if (!locale) continue
    const link = [...chunk.files]
      .filter(file => file.endsWith('.js'))
      .map(
        file => `<link rel="preload" as="script" href="${publicPath}${file}" />`
      )
      .join('')
    if (locale === 'en') {
      preloads.push(link)
    } else {
      preloads.push(`{{if eq .Locale "${locale}"}}${link}{{end}}`)
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
