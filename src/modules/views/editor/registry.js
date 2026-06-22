import { isDocs, shouldBeOpenedByOnlyOffice } from 'cozy-client/dist/models/file'

import { isGrist } from '@/modules/grist/helpers'
import {
  EXCALIDRAW_MIME,
  isExcalidraw,
  isExcalidrawEnabled,
  makeExcalidrawFileRoute
} from '@/modules/views/Excalidraw/helpers'
import {
  isOfficeEnabled,
  makeOnlyOfficeFileRoute
} from '@/modules/views/OnlyOffice/helpers'
import { makePdfRoute } from '@/modules/views/Pdf/helpers'

/**
 * @typedef {Object} EditorContext
 * @property {boolean} [isDesktop] - Some editors gate themselves on the device:
 *   OnlyOffice has a touch-screen flag variant.
 */

/**
 * @typedef {Object} EditorDescriptor
 * @property {string} slug - Route prefix and `computeFileType` return value.
 * @property {'editor'|'bridge'} kind - `'editor'` documents open in an in-app
 *   route mounted by Drive (Excalidraw, OnlyOffice, PDF). `'bridge'` documents
 *   open in another app reached through `/bridge/<app>` (Grist, Docs); they
 *   have no in-app route and must never be the target of an in-app redirect.
 * @property {string} [app] - The app that opens the document, as returned by
 *   `computeApp`. Absent (defaulting to `'drive'`) for in-app editors.
 * @property {string|null} flag - cozy-flag that gates mounting the editor's
 *   routes; `null` mounts them unconditionally (the editor gates access
 *   internally). This is the coarse, render-free gate read by the route layer.
 *   Irrelevant for `'bridge'` documents (they mount no route).
 * @property {(context: EditorContext) => boolean} [isEnabled] - Whether the
 *   editor claims files seen in listings. Reads cozy-flags directly. Richer
 *   than `flag` (e.g. OnlyOffice is device-aware), and absent for editors that
 *   never claim list items (e.g. PDF, which opens from the viewer).
 * @property {(file: object) => boolean} [matchesFile] - Recognizes the editor's
 *   files in a listing. Absent for editors only reachable from the viewer.
 * @property {(target: object) => boolean} [matchesShortcutTarget] - Recognizes
 *   the editor from the `metadata.target` of a file-root shared-drive `.url`
 *   shortcut, whose own name (`.url`) hides the real document. Only `'editor'`
 *   documents define it (a shared bridge document keeps its own handle).
 * @property {(file: object, options?: object) => string} makeRoute - Builds the
 *   link that opens `file`. In-app editors forward `options`
 *   (`{ driveId, fromPathname, fromPublicFolder }`) to their route builder;
 *   bridge documents ignore them and point at `/bridge/<app>/<externalId>`.
 */

const OFFICE_TARGET_CLASSES = ['text', 'spreadsheet', 'slide']

/**
 * The single source of truth for the document types Drive dispatches to a
 * dedicated editor or app. Adding one means adding one entry here; the
 * consumers (`computeFileType`, `computeApp`, `computePath`, the route layer)
 * all read from this list.
 *
 * Order matters for dispatch: descriptors are matched top to bottom, so the
 * more specific one wins. Bridge documents (Docs, Grist) come first because
 * they are recognized by an unambiguous handle; Excalidraw precedes OnlyOffice
 * because a `.excalidraw` file is a text-class document OnlyOffice would
 * otherwise claim.
 *
 * @type {EditorDescriptor[]}
 */
export const EDITORS = [
  {
    slug: 'docs',
    kind: 'bridge',
    app: 'docs',
    flag: null,
    isEnabled: () => true,
    matchesFile: file => isDocs(file),
    makeRoute: file => `/bridge/docs/${file.metadata.externalId}`
  },
  {
    slug: 'grist',
    kind: 'bridge',
    app: 'grist',
    flag: null,
    isEnabled: () => true,
    matchesFile: file => isGrist(file),
    makeRoute: file => `/bridge/grist/${file.metadata.externalId}`
  },
  {
    slug: 'excalidraw',
    kind: 'editor',
    flag: 'drive.excalidraw.enabled',
    isEnabled: () => isExcalidrawEnabled(),
    matchesFile: file => isExcalidraw(file),
    matchesShortcutTarget: target => target?.mime === EXCALIDRAW_MIME,
    makeRoute: (file, options) => makeExcalidrawFileRoute(file._id, options)
  },
  {
    slug: 'onlyoffice',
    kind: 'editor',
    // No single flag: Office enablement is device-aware (see isOfficeEnabled)
    // and its routes mount unconditionally so deep links keep working.
    flag: null,
    isEnabled: ({ isDesktop } = {}) => isOfficeEnabled(isDesktop),
    matchesFile: file => shouldBeOpenedByOnlyOffice(file),
    matchesShortcutTarget: target =>
      OFFICE_TARGET_CLASSES.includes(target?.class),
    makeRoute: (file, options) => makeOnlyOfficeFileRoute(file._id, options)
  },
  {
    slug: 'pdf',
    kind: 'editor',
    flag: 'drive.pdf-editor.enabled',
    // No matchesFile: PDFs open in the viewer (with an edit button), never from
    // a listing, so the dispatcher must not claim them.
    makeRoute: (file, options) => makePdfRoute(file._id, options)
  }
]

/**
 * Finds the document handler that should open a file seen in a listing.
 *
 * @param {object} file - An io.cozy.files document
 * @param {EditorContext} [context]
 * @returns {EditorDescriptor|undefined}
 */
export const findEditorForFile = (file, context = {}) =>
  EDITORS.find(
    editor =>
      Boolean(editor.matchesFile) &&
      editor.isEnabled(context) &&
      editor.matchesFile(file)
  )

/**
 * Finds the editor that should open the document behind a file-root shared-drive
 * `.url` shortcut, using its resolved `metadata.target`.
 *
 * @param {object} target - The shortcut's `metadata.target`
 * @param {EditorContext} [context]
 * @returns {EditorDescriptor|undefined}
 */
export const findEditorForShortcutTarget = (target, context = {}) =>
  EDITORS.find(
    editor =>
      Boolean(editor.matchesShortcutTarget) &&
      editor.isEnabled(context) &&
      editor.matchesShortcutTarget(target)
  )

/**
 * @param {string} slug
 * @returns {EditorDescriptor|undefined}
 */
export const findEditorBySlug = slug =>
  EDITORS.find(editor => editor.slug === slug)
