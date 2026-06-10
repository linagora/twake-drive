import flag from 'cozy-flags'

import { makeEditorFileRoute } from '@/modules/views/editor/helpers'

export const EXCALIDRAW_EXTENSION = 'excalidraw'
export const EXCALIDRAW_MIME = 'application/vnd.excalidraw+json'

/**
 * Checks whether a file is an Excalidraw drawing, based on its extension.
 *
 * @param {object} file - An io.cozy.files document
 * @returns {boolean}
 */
export const isExcalidraw = file =>
  Boolean(file?.name?.endsWith(`.${EXCALIDRAW_EXTENSION}`))

/**
 * Checks whether the Excalidraw feature is enabled through the flag.
 *
 * @returns {boolean}
 */
export const isExcalidrawEnabled = () =>
  flag('drive.excalidraw.enabled') === true

/**
 * Checks whether real-time collaboration is enabled through its own flag, so it
 * can be rolled out independently of the editor itself.
 *
 * @returns {boolean}
 */
export const isExcalidrawCollabEnabled = () =>
  flag('drive.excalidraw.collab') === true

/**
 * Builds the in-app route to open an Excalidraw file.
 *
 * @param {string} fileId - Id of the Excalidraw file
 * @param {import('@/modules/views/editor/helpers').EditorRouteOptions} [options]
 * @returns {string} Path to the Excalidraw editor
 */
export const makeExcalidrawFileRoute = (fileId, options) =>
  makeEditorFileRoute('excalidraw', fileId, options)

/**
 * Builds an empty, valid Excalidraw scene used as the initial content of a new
 * drawing.
 *
 * @param {string} [source] - Where the drawing was authored. Derived from the
 *   cozy client URI rather than a hardcoded brand URL so self-hosted instances
 *   identify themselves correctly. Excalidraw rewrites it on its own exports,
 *   so this only seeds the initial empty file.
 * @returns {object} An empty excalidraw scene
 */
export const makeEmptyScene = (source = '') => ({
  type: 'excalidraw',
  version: 2,
  source,
  elements: [],
  appState: {},
  files: {}
})

/**
 * Checks whether a parsed object is an Excalidraw scene (and not some other JSON
 * that happened to be in the file).
 *
 * @param {object} scene
 * @returns {boolean}
 */
export const isExcalidrawScene = scene => Array.isArray(scene?.elements)
