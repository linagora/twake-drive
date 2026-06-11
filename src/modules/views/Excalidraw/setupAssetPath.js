// Excalidraw loads its fonts and lazy chunks from the unpkg CDN by default,
// which a strict production CSP blocks. We self-host the fonts (copied to
// build/static/fonts by rsbuild, see rsbuild.config.mjs) and point Excalidraw
// at a same-origin path so they resolve under the app's own origin. The
// library fetches `${EXCALIDRAW_ASSET_PATH}fonts/...`, and the /static route
// is public, so the same path works for both the logged-in app and the public
// share pages.
//
// This file is imported before @excalidraw/excalidraw on purpose: the library
// reads window.EXCALIDRAW_ASSET_PATH when it initializes its webpack publicPath,
// so the value must be set first.
if (typeof window !== 'undefined') {
  if (!window.EXCALIDRAW_ASSET_PATH) {
    window.EXCALIDRAW_ASSET_PATH = '/static/'
  }
}
