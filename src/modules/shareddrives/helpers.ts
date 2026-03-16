import { IOCozyFile } from 'cozy-client/types/types'

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

export const isFromSharedDriveRecipient = (folder: IOCozyFile): boolean =>
  folder && Boolean(folder.driveId)
