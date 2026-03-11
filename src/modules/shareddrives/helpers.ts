import { IOCozyFile } from 'cozy-client/types/types'

import type { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { SHARED_DRIVES_DIR_ID } from '@/constants/config'

// Temporary type, need to be completed and then put in cozy-client
export interface SharedDrive {
  _id: string
  description: string
  rules: Rule[]
  owner?: boolean
}

export interface Rule {
  title: string
  values: string[]
}

/**
 * Extract the sharing id from a file/folder relationships.referenced_by
 * Returns undefined if not referenced by a sharing
 */
export const getSharingIdFromRelationships = (doc: {
  relationships?: {
    referenced_by?: { data?: { id: string; type: string }[] }
  }
}): string | undefined =>
  doc.relationships?.referenced_by?.data?.find(
    ref => ref.type === 'io.cozy.sharings'
  )?.id

export const getFolderIdFromSharing = (
  sharing: SharedDrive
): string | undefined => {
  try {
    return sharing.rules[0].values[0]
  } catch {
    return undefined
  }
}

export const isFolderFromSharedDriveRecipient = (folder: IOCozyFile): boolean =>
  folder && Boolean(folder.driveId)

export const isFolderFromSharedDriveOwner = (folder: IOCozyFile): boolean =>
  folder &&
  folder._type == 'io.cozy.files' &&
  folder.dir_id === SHARED_DRIVES_DIR_ID &&
  !isFolderFromSharedDriveRecipient(folder)

export const isSharedDriveFolder = (
  file: File | FolderPickerEntry
): boolean => {
  return (
    file._type === 'io.cozy.files' &&
    file.dir_id === 'io.cozy.files.shared-drives-dir' &&
    file.type === 'directory'
  )
}

export const isSharedDrive = (
  sharedDrive: SharedDrive,
  sharedDriveDirId: string
): boolean => {
  try {
    const parentId = sharedDrive.rules[0].values[0]

    return parentId === sharedDriveDirId
  } catch {
    return false
  }
}

export const isFederatedSharedFolder = (
  sharedDrive: SharedDrive,
  sharedDriveDirId: string
): boolean => {
  return !isSharedDrive(sharedDrive, sharedDriveDirId)
}
