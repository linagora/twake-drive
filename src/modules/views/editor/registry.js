import { shouldBeOpenedByOnlyOffice } from 'cozy-client/dist/models/file'

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
 * @property {string|null} flag - cozy-flag that gates mounting the editor's
 *   routes; `null` mounts them unconditionally (the editor gates access
 *   internally). This is the coarse, render-free gate read by the route layer.
 * @property {(context: EditorContext) => boolean} [isEnabled] - Whether the
 *   editor claims files seen in listings. Reads cozy-flags directly. Richer
 *   than `flag` (e.g. OnlyOffice is device-aware), and absent for editors that
 *   never claim list items (e.g. PDF, which opens from the viewer).
 * @property {(file: object) => boolean} [matchesFile] - Recognizes the editor's
 *   files in a listing. Absent for editors only reachable from the viewer.
 * @property {(target: object) => boolean} [matchesShortcutTarget] - Recognizes
 *   the editor from the `metadata.target` of a file-root shared-drive `.url`
 *   shortcut, whose own name (`.url`) hides the real document.
 * @property {(fileId: string, options?: object) => string} makeRoute
 */

const OFFICE_TARGET_CLASSES = ['text', 'spreadsheet', 'slide']

/**
 * The single source of truth for the document editors mounted in Drive. Adding
 * an editor means adding one entry here; the consumers (`computeFileType`, the
 * route layer) all read from this list.
 *
 * Order matters for dispatch: editors are matched top to bottom, so the more
 * specific editor wins. Excalidraw precedes OnlyOffice because a `.excalidraw`
 * file is a text-class document that OnlyOffice would otherwise claim.
 *
 * @type {EditorDescriptor[]}
 */
export const EDITORS = [
  {
    slug: 'excalidraw',
    flag: 'drive.excalidraw.enabled',
    isEnabled: () => isExcalidrawEnabled(),
    matchesFile: file => isExcalidraw(file),
    matchesShortcutTarget: target => target?.mime === EXCALIDRAW_MIME,
    makeRoute: makeExcalidrawFileRoute
  },
  {
    slug: 'onlyoffice',
    // No single flag: Office enablement is device-aware (see isOfficeEnabled)
    // and its routes mount unconditionally so deep links keep working.
    flag: null,
    isEnabled: ({ isDesktop } = {}) => isOfficeEnabled(isDesktop),
    matchesFile: file => shouldBeOpenedByOnlyOffice(file),
    matchesShortcutTarget: target =>
      OFFICE_TARGET_CLASSES.includes(target?.class),
    makeRoute: makeOnlyOfficeFileRoute
  },
  {
    slug: 'pdf',
    flag: 'drive.pdf-editor.enabled',
    // No matchesFile: PDFs open in the viewer (with an edit button), never from
    // a listing, so the dispatcher must not claim them.
    makeRoute: makePdfRoute
  }
]

/**
 * Finds the editor that should open a file seen in a listing.
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
