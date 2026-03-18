import CozyClient, { generateWebLink } from 'cozy-client'
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

export const makeSharedDriveNoteReturnUrl = (
  client: CozyClient,
  file: IOCozyFile
): string => {
  return generateWebLink({
    slug: 'drive',
    searchParams: [],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    cozyUrl: client.getStackClient().uri as string,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    subDomainType: client.getInstanceOptions().subdomain,
    pathname: '',
    hash: `/shareddrive/${file.driveId!}/${file.dir_id}`
  })
}
