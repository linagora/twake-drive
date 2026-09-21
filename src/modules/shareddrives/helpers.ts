import CozyClient, { generateWebLink } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'

import {
  getSharingsSharedDrivePath,
  getSharingsTabFromPath
} from '@/modules/views/Sharings/routes'

// Temporary type, need to be completed and then put in cozy-client
export interface SharedDrive {
  _id: string
  description: string
  rules: Rule[]
  owner?: boolean
  org_drive?: boolean
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

/**
 * True when the document carries a shared drive `driveId`. This is the
 * case for the shared drive root itself (folder or file) and, on the
 * recipient side, for any doc exposed inside the shared drive.
 *
 * The previous name `isFromSharedDriveRecipient` was misleading: this
 * check is shared-drive-shape-only, not recipient-specific. To assert
 * recipient intent, combine with `isOwner(doc._id)` from the sharing
 * context.
 */
export const isSharedDriveDoc = (folder: IOCozyFile): boolean =>
  folder && Boolean(folder.driveId)

/**
 * Absolute URL of a Drive route on the current instance, e.g. to come back to
 * it from an app opened on another instance.
 */
export const makeDriveWebLink = (client: CozyClient, hash: string): string =>
  generateWebLink({
    slug: 'drive',
    searchParams: [],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    cozyUrl: client.getStackClient().uri as string,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    subDomainType: client.getInstanceOptions().subdomain,
    pathname: '',
    hash
  })

/**
 * Drive route of the folder holding a shared drive note, inside the active
 * sharings tab when there is one.
 */
export const makeSharedDriveNoteHash = (
  file: IOCozyFile,
  pathname = ''
): string =>
  getSharingsTabFromPath(pathname)
    ? getSharingsSharedDrivePath(pathname, file.driveId, file.dir_id)
    : `/shareddrive/${file.driveId!}/${file.dir_id}`

export const makeSharedDriveNoteReturnUrl = (
  client: CozyClient,
  file: IOCozyFile,
  pathname = ''
): string => makeDriveWebLink(client, makeSharedDriveNoteHash(file, pathname))
