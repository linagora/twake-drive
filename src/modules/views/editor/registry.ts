import {
  isDocs,
  shouldBeOpenedByOnlyOffice
} from 'cozy-client/dist/models/file'
import { IOCozyFile } from 'cozy-client/types/types'
import flag from 'cozy-flags'

import type { File } from '@/components/FolderPicker/types'
import { isGrist } from '@/modules/grist/helpers'
import {
  EXCALIDRAW_MIME,
  isExcalidraw,
  isExcalidrawEnabled,
  makeExcalidrawFileRoute
} from '@/modules/views/Excalidraw/helpers'
import {
  canOpenPdfWithOnlyOffice,
  isOfficeEditingEnabled,
  isOfficeEnabled,
  makeOnlyOfficeFileRoute,
  shouldOpenWithOnlyOffice
} from '@/modules/views/OnlyOffice/helpers'
import { makePdfRoute } from '@/modules/views/Pdf/helpers'

/** Some editors gate themselves on the device: OnlyOffice has a touch-screen
 * flag variant. */
export interface EditorContext {
  isDesktop?: boolean
}

/** The add-menu state an editor's create entry reacts to. */
export interface CreateMenuContext {
  /** The add menu is shown on a public link. */
  isPublic?: boolean
  /** The current folder accepts new content. */
  canUpload?: boolean
  /** The device is a desktop (OnlyOffice gates document creation on it). */
  isDesktop?: boolean
}

/** Forwarded verbatim to an in-app editor's route builder; ignored by bridge
 * documents. */
export interface MakeRouteOptions {
  driveId?: string
  fromPathname?: string
  fromPublicFolder?: boolean
}

/** The resolved `metadata.target` of a file-root shared-drive `.url` shortcut. */
export interface ShortcutTarget {
  mime?: string
  class?: string
}

export interface EditorCreateDescriptor {
  /** Whether the editor's create entry should appear in the add menu. Reads
   * cozy-flags and the device directly, like `isEnabled`, so the gating lives
   * next to the editor definition; the add-menu component only owns the
   * rendering. */
  isAvailable: (context?: CreateMenuContext) => boolean
}

export interface EditorDescriptor {
  /** Route prefix and `computeFileType` return value. */
  slug: string
  /** `'editor'` documents open in an in-app route mounted by Drive (Excalidraw,
   * OnlyOffice, PDF). `'bridge'` documents open in another app reached through
   * `/bridge/<app>` (Grist, Docs); they have no in-app route and must never be
   * the target of an in-app redirect. */
  kind: 'editor' | 'bridge'
  /** The app that opens the document, as returned by `computeApp`. Absent
   * (defaulting to `'drive'`) for in-app editors. */
  app?: string
  /** cozy-flag that gates mounting the editor's routes; `null` mounts them
   * unconditionally (the editor gates access internally). Irrelevant for
   * `'bridge'` documents (they mount no route). */
  flag: string | null
  /** Whether the editor claims files seen in listings. Reads cozy-flags
   * directly. Richer than `flag` (e.g. OnlyOffice is device-aware), and absent
   * for editors that never claim list items (e.g. PDF, opened from the
   * viewer). */
  isEnabled?: (context?: EditorContext) => boolean
  /** Recognizes the editor's files in a listing. Absent for editors only
   * reachable from the viewer. */
  matchesFile?: (file: File) => boolean
  /** Recognizes the editor from a file-root shared-drive shortcut's resolved
   * target. The shortcut itself is passed along with its target. Only
   * `'editor'` documents define it (a shared bridge document keeps its own
   * handle). */
  matchesShortcutTarget?: (
    target: ShortcutTarget | undefined,
    shortcut: IOCozyFile
  ) => boolean
  /** Builds the link that opens `file`. In-app editors forward `options` to
   * their route builder; bridge documents ignore them and point at
   * `/bridge/<app>/<externalId>`. */
  makeRoute: (file: File, options?: MakeRouteOptions) => string
  /** Add-menu "create a document" capability. Absent for editors that cannot
   * create documents (e.g. PDF). */
  create?: EditorCreateDescriptor
}

/**
 * The single source of truth for the document types Drive dispatches to a
 * dedicated editor or app. Adding one means adding one entry here; the
 * consumers (`computeFileType`, `computeApp`, `computePath`, the route layer,
 * the add menu) all read from this list.
 *
 * Order matters: descriptors are matched top to bottom for dispatch (the more
 * specific one wins — Excalidraw precedes OnlyOffice because a `.excalidraw`
 * file is a text-class document OnlyOffice would otherwise claim) and the add
 * menu lists the create entries in the same order. The bridge documents (Docs,
 * Grist) match on an unambiguous handle, so their position is free; they sit
 * where the add menu wants them.
 */
export const EDITORS: EditorDescriptor[] = [
  {
    slug: 'docs',
    kind: 'bridge',
    app: 'docs',
    flag: null,
    isEnabled: () => true,
    matchesFile: file => isDocs(file),
    makeRoute: file =>
      `/bridge/docs/${(file as IOCozyFile).metadata.externalId}`,
    create: {
      isAvailable: ({ isPublic } = {}) =>
        !isPublic && Boolean(flag('drive.lasuitedocs.enabled'))
    }
  },
  {
    slug: 'excalidraw',
    kind: 'editor',
    flag: 'drive.excalidraw.enabled',
    isEnabled: () => Boolean(isExcalidrawEnabled()),
    matchesFile: file => Boolean(isExcalidraw(file)),
    matchesShortcutTarget: target => target?.mime === EXCALIDRAW_MIME,
    makeRoute: (file, options) => makeExcalidrawFileRoute(file._id, options),
    create: {
      // Excalidraw can be created on a public link too, when the visitor may
      // upload to the folder.
      isAvailable: ({ isPublic, canUpload } = {}) =>
        Boolean(isExcalidrawEnabled()) && (!isPublic || canUpload === true)
    }
  },
  {
    slug: 'grist',
    kind: 'bridge',
    app: 'grist',
    flag: null,
    isEnabled: () => true,
    matchesFile: file => Boolean(isGrist(file)),
    makeRoute: file =>
      `/bridge/grist/${(file as IOCozyFile).metadata.externalId}`,
    create: {
      isAvailable: ({ isPublic } = {}) =>
        !isPublic && Boolean(flag('drive.grist.enabled'))
    }
  },
  {
    slug: 'onlyoffice',
    kind: 'editor',
    // No single flag: Office enablement is device-aware (see isOfficeEnabled)
    // and its routes mount unconditionally so deep links keep working.
    flag: null,
    isEnabled: ({ isDesktop } = {}) => Boolean(isOfficeEnabled(isDesktop)),
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
    makeRoute: (file, options) => makeOnlyOfficeFileRoute(file._id, options),
    create: {
      isAvailable: ({ canUpload, isDesktop } = {}) =>
        canUpload === true && Boolean(isOfficeEditingEnabled(isDesktop))
    }
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

/** Finds the document handler that should open a file seen in a listing. */
export const findEditorForFile = (
  file: File,
  context: EditorContext = {}
): EditorDescriptor | undefined =>
  EDITORS.find(
    editor =>
      Boolean(editor.matchesFile) &&
      Boolean(editor.isEnabled?.(context)) &&
      Boolean(editor.matchesFile?.(file))
  )

/**
 * Finds the editor that should open the document behind a file-root shared-drive
 * `.url` shortcut, using its resolved `metadata.target`.
 */
export const findEditorForShortcutTarget = (
  shortcut: IOCozyFile,
  context: EditorContext = {}
): EditorDescriptor | undefined =>
  EDITORS.find(
    editor =>
      Boolean(editor.matchesShortcutTarget) &&
      Boolean(editor.isEnabled?.(context)) &&
      Boolean(
        editor.matchesShortcutTarget?.(shortcut.metadata?.target, shortcut)
      )
  )

export const findEditorBySlug = (slug: string): EditorDescriptor | undefined =>
  EDITORS.find(editor => editor.slug === slug)
