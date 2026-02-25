import { splitFilename } from 'cozy-client/dist/models/file'
import type { IOCozyFile } from 'cozy-client/types/types'

import type { File } from '@/components/FolderPicker/types'
import {
  TRASH_DIR_ID,
  ROOT_DIR_ID,
  SHARED_DRIVES_DIR_ID,
  SHARINGS_VIEW_ROUTE
} from '@/constants/config'
import { isNextcloudShortcut } from '@/modules/nextcloud/helpers'

export const isDriveBackedFile = (file: File): boolean => !!file.driveId

export const makeParentFolderPath = (file: File): string => {
  if (file.dir_id === SHARED_DRIVES_DIR_ID) {
    return SHARINGS_VIEW_ROUTE
  }

  if (!file.path) return ''

  return file.dir_id === ROOT_DIR_ID
    ? file.path.replace(file.name, '')
    : file.path.replace(`/${file.name}`, '')
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

  // we can have ROOT_DIR_ID in some case, like in sharing view when fetching docs for the first time
  // in that case we want to do the same trick as for SHARED_DRIVES_DIR_ID
  if (file._id === SHARED_DRIVES_DIR_ID || file._id === ROOT_DIR_ID) {
    return {
      title: t('FileName.sharedDrive'),
      filename: t('FileName.sharedDrive')
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
