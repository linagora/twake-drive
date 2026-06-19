// Excalidraw loads its fonts and lazy chunks from the unpkg CDN by default,
// which a strict production CSP blocks. We self-host the assets (copied to each
// build by rsbuild, see rsbuild.config.mjs) and point Excalidraw at a
// same-origin path so they resolve under the app's own origin.
//
// We derive the path from the target (main is served at "/", the public share
// build at "/public/") rather than from the webpack public path, because in dev
// the latter is the cross-origin rsbuild dev server (localhost:3000), which gets
// fonts rejected by the browser's font sanitizer and the lazy chunks blocked.
//
// This file is imported before @excalidraw/excalidraw on purpose: the library
// reads window.EXCALIDRAW_ASSET_PATH when it initializes its webpack publicPath,
// so the value must be set first.
if (typeof window !== 'undefined') {
  const isPublic = window.location.pathname.startsWith('/public')
  const assetPath = isPublic ? '/public/' : '/'

  if (!window.EXCALIDRAW_ASSET_PATH) {
    window.EXCALIDRAW_ASSET_PATH = assetPath
  }

  // Excalidraw also code-splits browser-fs-access, its locale bundles and a few
  // polyfills as webpack async chunks, which load from __webpack_public_path__
  // rather than EXCALIDRAW_ASSET_PATH. In dev that path is the cross-origin main
  // dev server (localhost:3000), unreachable from the public build served under
  // /public, so the editor's locale and file actions fail to load there. Point
  // it at the same-origin path for the public build (a no-op in production,
  // where it already resolves to /public).
  if (isPublic) {
    // eslint-disable-next-line no-undef
    __webpack_public_path__ = assetPath
  }
}
