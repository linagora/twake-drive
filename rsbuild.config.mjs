import { defineConfig, mergeRsbuildConfig } from '@rsbuild/core'
import { getRsbuildConfig } from 'rsbuild-config-cozy-app'

const config = getRsbuildConfig({
  title: 'Twake Drive',
  hasServices: true,
  hasPublic: true,
  hasIntents: true
})

// rsbuild-config-cozy-app declares one environment (= one rspack compilation)
// per web target, so the three targets each re-bundle React, cozy-* and the
// editors into their own static/ tree and the registry tarball pays for every
// module up to three times. We replace those three environments with a single
// `web` environment holding the three entries: one chunk graph means shared
// modules are emitted exactly once, under one static/ tree.
//
// All hashed assets stay in build/static and are served by the `/static`
// route, declared `public: true` in manifest.webapp so the public (shared
// link) pages can load them without auth. The main entry's HTML stays at the
// bundle root (build/index.html, see tools.htmlPlugin) so the `/` route serves
// it and the native app can load it directly; public/intents keep their own
// [name]/index.html.
const { main, public: publicEnv, intents, services } = config.environments

const templates = {
  main: main.html.template,
  public: publicEnv.html.template,
  intents: intents.html.template
}

config.environments = {
  web: {
    html: {
      template: ({ entryName }) => templates[entryName]
    },
    source: {
      entry: {
        main: main.source.entry.main,
        public: publicEnv.source.entry.public,
        intents: intents.source.entry.intents
      }
    },
    output: {
      target: 'web',
      filename: {
        html: '[name]/index.html'
      },
      distPath: {
        root: 'build'
      },
      copy: [
        // manifest.webapp, README, LICENSE and public/ -> assets, as the
        // generated main environment declared them.
        ...main.output.copy,
        {
          from: 'src/assets/onlyOffice',
          to: 'onlyOffice'
        },
        {
          from: 'src/assets/favicons',
          to: 'favicons'
        },
        // Self-host the Excalidraw fonts (the default unpkg CDN is blocked by
        // our CSP). Since 0.18 the library fetches them at runtime from
        // `${EXCALIDRAW_ASSET_PATH}fonts/...`; the asset path is set to
        // /static/ in src/modules/views/Excalidraw/setupAssetPath.js. The prod
        // and dev font sets are byte-identical, so we copy only the prod one.
        // `info.minimized` stops rspack from re-minifying the prebuilt assets.
        //
        // Xiaolai is excluded: it is Excalidraw's CJK fallback font, ~12 MB of
        // woff2 subsets (every other font set is <1 MB total), and we do not
        // ship CJK glyph rendering for drawings.
        {
          from: 'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
          to: 'static/fonts',
          globOptions: { ignore: ['**/Xiaolai/**'] },
          info: { minimized: true }
        }
      ]
    },
    tools: {
      // One environment emits every entry's HTML as `[name]/index.html`, which
      // would put the main app at /main/index.html. The native (flagship) app
      // loads the bundle's root index.html directly, so the main entry must stay
      // at build/index.html; the other entries keep their per-name folder.
      htmlPlugin(htmlConfig, { entryName }) {
        htmlConfig.filename =
          entryName === 'main' ? 'index.html' : `${entryName}/index.html`
      },
      rspack: {
        output: {
          // Asset modules without a dedicated rsbuild rule (e.g. the pdf.js
          // worker react-pdf imports as a resource) default to `[hash][ext]`
          // at the build root, which only the private `/` route serves. Keep
          // them under static/ so the public route covers them too.
          assetModuleFilename: 'static/resource/[hash][ext][query]'
        }
      }
    }
  },
  services
}

const mergedConfig = mergeRsbuildConfig(config, {
  // Rsbuild enables dev.lazyCompilation by default, which defers compiling async
  // chunks until the browser requests them from the dev server's on-demand
  // compile endpoint. That endpoint lives on the rsbuild dev server, but the app
  // is served by cozy-stack on a different origin, so the request hits cozy-stack
  // and 404s. The EmbedPDF (Pdfium) engine the PDF editor loads as an async chunk
  // then never finishes initializing and the editor hangs. Disable it so chunks
  // compile eagerly; HMR is unaffected.
  dev: {
    lazyCompilation: false
  },
  resolve: {
    alias: {
      // The webpack5 entry wires the pdf.js worker through a `new URL(...)`
      // asset module, so it honors assetModuleFilename and lands under
      // static/ (the webpack4 entry inlines file-loader, which emits the
      // worker at the build root where only the private `/` route serves it).
      'react-pdf$': 'react-pdf/dist/esm/entry.webpack5'
    }
  }
})

export default defineConfig(mergedConfig)
