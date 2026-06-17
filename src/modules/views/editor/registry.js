import { shouldBeOpenedByOnlyOffice } from 'cozy-client/dist/models/file'

import {
  EXCALIDRAW_MIME,
  isExcalidraw,
  makeExcalidrawFileRoute
} from '@/modules/views/Excalidraw/helpers'
import { makeOnlyOfficeFileRoute } from '@/modules/views/OnlyOffice/helpers'

/**
 * @typedef {Object} EditorEnablement
 * @property {boolean} [isOfficeEnabled]
 * @property {boolean} [isExcalidrawEnabled]
 */

/**
 * @typedef {Object} EditorDescriptor
 * @property {string} slug - Route prefix and `computeFileType` return value.
 * @property {(enablement: EditorEnablement) => boolean} isEnabled - Whether the
 *   editor is active for the current instance.
 * @property {(file: object) => boolean} [matchesFile] - Recognizes the editor's
 *   files when seen in a listing (the file's own name/class/mime). Absent for
 *   editors that are only reachable from the viewer (e.g. PDF), so they keep
 *   opening in the viewer rather than from lists.
 * @property {(target: object) => boolean} [matchesShortcutTarget] - Recognizes
 *   the editor from the `metadata.target` of a file-root shared-drive `.url`
 *   shortcut, whose own name (`.url`) hides the real document.
 * @property {(fileId: string, options?: object) => string} makeRoute - Builds
 *   the in-app route to the full-screen editor.
 */

const OFFICE_TARGET_CLASSES = ['text', 'spreadsheet', 'slide']

/**
 * The single source of truth for the document editors mounted in Drive. Adding
 * a new editor type means adding one entry here; the consumers (`computeFileType`,
 * route generation and the viewer openers) all read from this list.
 *
 * Order matters: editors are matched top to bottom, so the more specific editor
 * wins. Excalidraw precedes OnlyOffice because a `.excalidraw` file is a
 * text-class document that OnlyOffice would otherwise claim.
 *
 * @type {EditorDescriptor[]}
 */
export const EDITORS = [
  {
    slug: 'excalidraw',
    isEnabled: ({ isExcalidrawEnabled }) => Boolean(isExcalidrawEnabled),
    matchesFile: file => isExcalidraw(file),
    matchesShortcutTarget: target => target?.mime === EXCALIDRAW_MIME,
    makeRoute: makeExcalidrawFileRoute
  },
  {
    slug: 'onlyoffice',
    isEnabled: ({ isOfficeEnabled }) => Boolean(isOfficeEnabled),
    matchesFile: file => shouldBeOpenedByOnlyOffice(file),
    matchesShortcutTarget: target =>
      OFFICE_TARGET_CLASSES.includes(target?.class),
    makeRoute: makeOnlyOfficeFileRoute
  }
]

/**
 * Finds the editor that should open a file seen in a listing.
 *
 * @param {object} file - An io.cozy.files document
 * @param {EditorEnablement} enablement
 * @returns {EditorDescriptor|undefined}
 */
export const findEditorForFile = (file, enablement) =>
  EDITORS.find(
    editor =>
      editor.isEnabled(enablement) && Boolean(editor.matchesFile?.(file))
  )

/**
 * Finds the editor that should open the document behind a file-root shared-drive
 * `.url` shortcut, using its resolved `metadata.target`.
 *
 * @param {object} target - The shortcut's `metadata.target`
 * @param {EditorEnablement} enablement
 * @returns {EditorDescriptor|undefined}
 */
export const findEditorForShortcutTarget = (target, enablement) =>
  EDITORS.find(
    editor =>
      editor.isEnabled(enablement) &&
      Boolean(editor.matchesShortcutTarget?.(target))
  )

/**
 * @param {string} slug
 * @returns {EditorDescriptor|undefined}
 */
export const findEditorBySlug = slug =>
  EDITORS.find(editor => editor.slug === slug)
