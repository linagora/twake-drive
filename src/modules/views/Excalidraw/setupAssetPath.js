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
if (typeof window !== 'undefined' && !window.EXCALIDRAW_ASSET_PATH) {
  window.EXCALIDRAW_ASSET_PATH = window.location.pathname.startsWith('/public')
    ? '/public/'
    : '/'
}
