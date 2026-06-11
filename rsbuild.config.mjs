import { defineConfig, mergeRsbuildConfig } from '@rsbuild/core'
import { getRsbuildConfig } from 'rsbuild-config-cozy-app'

const config = getRsbuildConfig({
  title: 'Twake Drive',
  hasServices: true,
  hasPublic: true,
  hasIntents: true
})

// Self-host the Excalidraw fonts (the default unpkg CDN is blocked by our CSP).
// Since 0.18 the library fetches them at runtime from `${EXCALIDRAW_ASSET_PATH}
// fonts/...`, so we copy them to a top-level `fonts` directory. The asset path
// is set in src/modules/views/Excalidraw/setupAssetPath.js. The prod and dev
// font sets are byte-identical, so we copy only the prod one (both build modes
// resolve the same `fonts/...` filenames at runtime). `info.minimized` stops
// rspack from re-minifying the prebuilt assets.
//
// Xiaolai is excluded: it is Excalidraw's CJK fallback font, ~12 MB of woff2
// subsets (every other font set is <1 MB total), and we do not ship CJK glyph
// rendering for drawings. Drop it to keep the build under the registry limit.
const excalidrawAssets = [
  {
    from: 'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
    to: 'fonts',
    globOptions: { ignore: ['**/Xiaolai/**'] },
    info: { minimized: true }
  }
]

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
  environments: {
    main: {
      output: {
        copy: [
          {
            from: 'src/assets/onlyOffice',
            to: 'onlyOffice'
          },
          {
            from: 'src/assets/favicons',
            to: 'favicons'
          },
          ...excalidrawAssets
        ]
      }
    },
    // The public (shared link) target is a separate build, so it needs its own
    // copy of the Excalidraw assets to serve them under its /public prefix.
    public: {
      output: {
        copy: [...excalidrawAssets]
      }
    }
  },
  resolve: {
    alias: {
      'react-pdf$': 'react-pdf/dist/esm/entry.webpack'
    }
  }
})

export default defineConfig(mergedConfig)
