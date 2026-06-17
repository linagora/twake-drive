import { shouldBeOpenedByOnlyOffice } from 'cozy-client/dist/models/file'

import {
  EXCALIDRAW_MIME,
  isExcalidraw,
  makeExcalidrawFileRoute
} from '@/modules/views/Excalidraw/helpers'
import {
  canOpenPdfWithOnlyOffice,
  makeOnlyOfficeFileRoute,
  shouldOpenWithOnlyOffice
} from '@/modules/views/OnlyOffice/helpers'

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
 * @property {(target: object, shortcut: object) => boolean} [matchesShortcutTarget]
 *   - Recognizes the editor from the `metadata.target` of a file-root
 *   shared-drive `.url` shortcut, whose own name (`.url`) hides the real
 *   document. The shortcut itself is passed along with its target.
 * @property {(fileId: string, options?: object) => string} makeRoute - Builds
 *   the in-app route to the full-screen editor.
 */

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
    // isEnabled already checked that Office is enabled; PDFs also need the
    // PDF editing flag.
    matchesFile: file => shouldOpenWithOnlyOffice(file, true),
    // The class alone is not enough: any text/* mime (.vcf, .ics, .txt) gets
    // class 'text', so the target mime is checked too. The shortcut keeps its
    // own name: one named *.txt or *.md does not open in OnlyOffice.
    matchesShortcutTarget: (target, shortcut) =>
      shouldBeOpenedByOnlyOffice({
        ...shortcut,
        class: target?.class,
        mime: target?.mime
      }) ||
      (target?.class === 'pdf' && canOpenPdfWithOnlyOffice(true)),
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
 * @param {object} shortcut - The `.url` shortcut, an io.cozy.files document
 * @param {EditorEnablement} enablement
 * @returns {EditorDescriptor|undefined}
 */
export const findEditorForShortcutTarget = (shortcut, enablement) =>
  EDITORS.find(
    editor =>
      editor.isEnabled(enablement) &&
      Boolean(
        editor.matchesShortcutTarget?.(shortcut.metadata?.target, shortcut)
      )
  )

/**
 * @param {string} slug
 * @returns {EditorDescriptor|undefined}
 */
export const findEditorBySlug = slug =>
  EDITORS.find(editor => editor.slug === slug)
