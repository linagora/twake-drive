import CozyClient from 'cozy-client'
import {
  isShortcut,
  isNote,
  isDocs,
  isDirectory
} from 'cozy-client/dist/models/file'
import { IOCozyFile } from 'cozy-client/types/types'

import type { File } from '@/components/FolderPicker/types'
import { TRASH_DIR_ID, SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { joinPath } from '@/lib/path'
import { isGrist } from '@/modules/grist/helpers'
import {
  isNextcloudShortcut,
  isNextcloudFile
} from '@/modules/nextcloud/helpers'
import {
  getSharedDriveRootFilePath,
  getSharedDriveRootFilePathScope
} from '@/modules/routeUtils'
import { makeSharedDriveNoteReturnUrl } from '@/modules/shareddrives/helpers'
import {
  isFileRootSharedDrive,
  isFileRootSharedDriveShortcut,
  isResolvableFileRootSharedDriveShortcut
} from '@/modules/shareddrives/rootFileNavigation'
import {
  findEditorBySlug,
  findEditorForFile,
  findEditorForShortcutTarget
} from '@/modules/views/editor/registry'

interface ComputeFileTypeOptions {
  isOfficeEnabled?: boolean
  isExcalidrawEnabled?: boolean
  isPublic?: boolean
  cozyUrl?: string
}

interface ComputePathOptions {
  type: string
  pathname: string
  isPublic: boolean
  client: CozyClient | null
  isOwner?: boolean
}

export const computeFileType = (
  file: File,
  {
    isOfficeEnabled = false,
    isExcalidrawEnabled = false,
    isPublic = false,
    cozyUrl = ''
  }: ComputeFileTypeOptions = {}
): string => {
  // Editors (Excalidraw, OnlyOffice, …) are dispatched from a single registry
  // so a new document type is wired in one place. Computed up front, but only
  // consulted below after the higher-priority types (trash, notes, docs).
  const editorForFile = findEditorForFile(file, {
    isOfficeEnabled,
    isExcalidrawEnabled
  })

  if (file._id === TRASH_DIR_ID) {
    return 'trash'
  } else if (file._id === 'io.cozy.remote.nextcloud.files.trash-dir') {
    return 'nextcloud-trash'
  } else if (
    file.dir_id === SHARED_DRIVES_DIR_ID &&
    !isFileRootSharedDrive(file) &&
    !isFileRootSharedDriveShortcut(file) &&
    !isNextcloudShortcut(file)
  ) {
    return 'shared-drive'
  } else if (file._type === 'io.cozy.remote.nextcloud.files') {
    return isDirectory(file) ? 'nextcloud-directory' : 'nextcloud-file'
  } else if (isNote(file)) {
    // createdOn url ends with a trailing slash whereas cozyUrl does not joinPath fixes this
    const isSameInstance =
      joinPath(cozyUrl, '') === file.cozyMetadata?.createdOn

    if (isPublic && isSameInstance) {
      return 'public-note-same-instance'
    } else if (isSameInstance) {
      return 'note'
    } else {
      return 'public-note'
    }
  } else if (isDocs(file)) {
    return 'docs'
  } else if (isGrist(file)) {
    return 'grist'
  } else if (editorForFile) {
    // A `.excalidraw`/Office file opens in its editor. Runs before the
    // shared-drive and shortcut branches so an Office file shared as a drive
    // root still routes through its editor rather than the generic viewer.
    return editorForFile.slug
  } else if (isResolvableFileRootSharedDriveShortcut(file)) {
    // File-root shared drives are materialized on the recipient as `.url`
    // shortcuts (`class: 'shortcut'`, mime `application/internet-shortcut`),
    // so the file's own name hides the real document. The stack exposes it in
    // `metadata.target`; route it to the matching editor (so a shared
    // Excalidraw drawing or Office file opens in its editor), otherwise fall
    // back to the generic shared-drive root-file viewer.
    const editorForTarget = findEditorForShortcutTarget(
      file.metadata?.target,
      { isOfficeEnabled, isExcalidrawEnabled }
    )
    if (editorForTarget) {
      return editorForTarget.slug
    }
    return 'shared-drive-root-file'
  } else if (isNextcloudShortcut(file)) {
    return 'nextcloud'
  } else if (isShortcut(file)) {
    return 'shortcut'
  } else if (isDirectory(file)) {
    return 'directory'
  } else if (
    isFileRootSharedDrive(file) &&
    file.dir_id === SHARED_DRIVES_DIR_ID
  ) {
    return 'shared-drive-root-file'
  } else if (file.driveId && file.dir_id && !isFileRootSharedDrive(file)) {
    // Any file carrying a driveId is a proxied shared-drive file, except the
    // owner's own file-root sharing root (which lives locally and is caught
    // by isFileRootSharedDrive). Keying on dir_id === SHARED_DRIVES_DIR_ID
    // here used to drop every recipient file nested in a shared-drive folder
    // back to the local /files/:id route, which 404s. dir_id is required
    // because the shared-drive route is built from it; without it, fall back
    // to 'file' rather than letting computePath throw.
    return 'shared-drive-file'
  } else {
    return 'file'
  }
}

export const computeApp = (type: string): string => {
  switch (type) {
    case 'nextcloud-file':
      return 'nextcloud'
    case 'note':
    case 'public-note-same-instance':
      return 'notes'
    case 'docs':
      return 'docs'
    case 'grist':
      return 'grist'
    default:
      return 'drive'
  }
}

const computeNextcloudPath = (
  type: string,
  file: File,
  pathname: string
): string => {
  switch (type) {
    case 'nextcloud-trash':
      return `${pathname}/trash`
    case 'nextcloud':
      return `/nextcloud/${file.cozyMetadata?.sourceAccount ?? 'unknown'}`
    case 'nextcloud-directory':
      return `${pathname}?path=${file.path ?? '/'}`
    default:
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return file.links?.self ?? ''
  }
}

export const computePath = (
  file: File,
  { type, pathname, isPublic, client, isOwner = false }: ComputePathOptions
): string => {
  const paths = pathname.split('/').slice(1)
  const driveId = file.driveId as string | undefined

  if (type.startsWith('nextcloud')) {
    return computeNextcloudPath(type, file, pathname)
  }

  const editor = findEditorBySlug(type)
  if (editor) {
    return editor.makeRoute(file._id, {
      driveId,
      fromPathname: pathname,
      fromPublicFolder: isPublic
    })
  }

  switch (type) {
    case 'trash':
      return '/trash'
    case 'note':
      return `/n/${file._id}`
    case 'public-note-same-instance':
      return `/?id=${file._id}`
    case 'public-note':
      if (driveId) {
        const returnUrl = client
          ? makeSharedDriveNoteReturnUrl(client, file as IOCozyFile)
          : ''

        return `/note/${driveId}/${file._id}?returnUrl=${encodeURIComponent(
          returnUrl
        )}`
      } else {
        return `/note/${file._id}`
      }
    case 'docs':
      return `/bridge/docs/${(file as IOCozyFile).metadata.externalId}`
    case 'grist':
      return `/bridge/grist/${(file as IOCozyFile).metadata.externalId}`
    case 'shortcut':
      return `/external/${file._id}`
    case 'directory':
      // When the user is the owner of a sharing displayed in /sharings, the
      // file/folder is the real io.cozy.files document living in their Drive,
      // so we must drop the /sharings prefix and open it in the normal Drive
      // folder view instead of the sharings folder view.
      if (isOwner && pathname.startsWith('/sharings')) {
        return `/folder/${file._id}`
      }
      // On mobile, if we are in /favorites tab, we do not want it to appears in computed path
      // so we redirect to root route for folders
      if (pathname.startsWith('/favorites')) {
        return `/folder/${file._id}`
      }
      // paths with only one element correspond to the root of a page like /sharings
      // when we add id we want to keep the path before to make /sharings/id
      return paths.length === 1 ? file._id : `../${file._id}`
    case 'shared-drive':
      // Without driveId, we should use path `/folder/:folderId` because it's shared drive folder of owner
      if (!driveId) {
        return `/folder/${file._id}`
      }

      return `/shareddrive/${driveId}/${file._id}`
    case 'shared-drive-root-file':
      if (!driveId || isNextcloudFile(file)) {
        throw new Error(
          'Missing driveId or invalid file type in shared drive root file'
        )
      }
      return getSharedDriveRootFilePath({
        driveId,
        fileId: file._id,
        scope: getSharedDriveRootFilePathScope(pathname)
      })
    case 'shared-drive-file':
      if (!driveId || isNextcloudFile(file)) {
        throw new Error(
          'Missing driveId or invalid file type in shared drive file'
        )
      }
      if (!file.dir_id) {
        throw new Error('Missing dir_id in shared drive file')
      }
      return `/shareddrive/${driveId}/${file.dir_id}/file/${file._id}`
    default:
      // Owner of a file shown in /sharings owns the real io.cozy.files
      // document on their instance, so the file should open in the normal
      // Drive viewer (`/folder/:dirId/file/:fileId`) and leave the sharings
      // section. Recipients (and the rest of the file cases) keep the
      // existing relative /sharings/file/:fileId path.
      if (isOwner && pathname.startsWith('/sharings')) {
        return `/folder/${file.dir_id}/file/${file._id}`
      }
      // On mobile, if we are in /favorites tab, we do not want it to appears in computed path
      // so we redirect to root route for files
      if (pathname.startsWith('/favorites')) {
        return `/folder/${file.dir_id}/file/${file._id}`
      }

      return `file/${file._id}`
  }
}
