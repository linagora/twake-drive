import { splitFilename } from 'cozy-client/dist/models/file'
import type { IOCozyFile } from 'cozy-client/types/types'

import type { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import {
  TRASH_DIR_ID,
  ROOT_DIR_ID,
  SHARINGS_VIEW_ROUTE
} from '@/constants/config'
import { isNextcloudShortcut } from '@/modules/nextcloud/helpers'

export const isDriveBackedFile = (file: File): boolean => !!file.driveId

export const makeFileMetadata = (
  formattedUpdatedAt?: string,
  formattedSize?: string
): string => [formattedUpdatedAt, formattedSize].filter(Boolean).join(' - ')

export const makeParentFolderPath = (file: File): string => {
  if (file.driveId && !file.dir_id) {
    return SHARINGS_VIEW_ROUTE
  }

  if (!file.path) return ''

  // A file at the root always lives directly under "/". Deriving the parent
  // from file.path instead would yield "//" when the path already carries a
  // leading slash (e.g. after a save updates it to "//name").
  return file.dir_id === ROOT_DIR_ID
    ? '/'
    : file.path.replace(`/${file.name}`, '')
}

/**
 * Name of the parent folder only: "/" at the local root, the drive name at
 * the root of a drive. A drive item's path is relative to the drive root, and
 * the root of a drive has no path at all.
 */
export const makeParentFolderName = (
  file: Pick<FolderPickerEntry, 'path' | 'dir_id' | 'driveId'>,
  findDriveName: (driveId: string) => string | null
): string => {
  if (!file.path) return ''

  if (!file.driveId && file.dir_id === ROOT_DIR_ID) return '/'

  const parentPath = file.path.slice(0, file.path.lastIndexOf('/'))
  if (parentPath === '') {
    return file.driveId ? (findDriveName(file.driveId) ?? '') : '/'
  }

  return parentPath.slice(parentPath.lastIndexOf('/') + 1)
}

export const getFileNameAndExtension = (
  file: File,
  t: (key: string) => string
): {
  title: string
  filename: string
  extension?: string
} => {
  if (file._id === TRASH_DIR_ID) {
    return {
      title: t('FileName.trash'),
      filename: t('FileName.trash')
    }
  }

  const { filename, extension } = splitFilename(file)

  if (file._type === 'io.cozy.files' && isNextcloudShortcut(file)) {
    return {
      title: filename,
      filename: filename
    }
  }

  return {
    title: file.name,
    filename,
    extension
  }
}

export interface FileWithAntivirusScan {
  antivirus_scan?: {
    status?: 'clean' | 'infected' | 'skipped' | 'error' | 'pending'
  }
}

export const isInfected = (
  file?: (FileWithAntivirusScan & Partial<IOCozyFile>) | null
): boolean => {
  return file?.antivirus_scan?.status === 'infected'
}

export const isNotScanned = (
  file?: (FileWithAntivirusScan & Partial<IOCozyFile>) | null
): boolean => {
  const status = file?.antivirus_scan?.status
  return status === 'pending' || status === 'skipped' || status === 'error'
}
