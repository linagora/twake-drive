import { Mutations } from 'cozy-client'
import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { receiveMutationResult } from 'cozy-client/dist/store'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'

const MAX_VISIBLE_INVITATIONS = 4

/**
 * @typedef {object} InvitationActionParams
 * @property {import('cozy-client').default} client
 * @property {import('cozy-client/types').IOCozyFile} file - Sharing shortcut of the invitation
 * @property {Function} showAlert - showAlert from the cozy-ui alert provider
 * @property {Function} t - Translation function
 */

export const buildSharingsActionsOptions = ({
  base,
  nativeSharing,
  sharingContext,
  filteredResult
}) => {
  const { allLoaded, refresh, isOwner, canLeave } = sharingContext

  return {
    ...base,
    ...nativeSharing,
    refresh,
    isOwner,
    canLeave,
    hasWriteAccess: true,
    canMove: true,
    isPublic: false,
    shouldHideIfSharedDriveRecipient: true,
    allLoaded,
    // Select All has to match the rendered list, not the raw query: the
    // rendered list excludes the magic shared-drives dir when the feature
    // flags are off and substitutes transformed shortcut entries when on.
    selectAll: () => base.toggleSelectAllItems(filteredResult.data)
  }
}

/**
 * Returns the oldest new sharing shortcuts, up to MAX_VISIBLE_INVITATIONS
 *
 * @param {import('cozy-client/types').IOCozyFile[] | undefined} files
 * @returns {import('cozy-client/types').IOCozyFile[]}
 */
export const getVisibleInvitations = files =>
  (files ?? [])
    .filter(isSharingShortcutNew)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, MAX_VISIBLE_INVITATIONS)

/**
 * Marks a sharing invitation as seen, alerting the user on failure
 *
 * @param {InvitationActionParams} params
 * @returns {Promise<void>}
 */
export const saveInvitationAsSeen = async ({ client, file, showAlert, t }) => {
  try {
    await client.save({
      ...file,
      metadata: {
        ...file.metadata,
        sharing: { ...file.metadata.sharing, status: 'seen' }
      }
    })
  } catch (error) {
    logger.error(`Marking sharing invitation ${file._id} as seen failed`, error)
    showAlert({ message: t('alert.try_again'), severity: 'error' })
  }
}

/**
 * Permanently deletes the shortcut of a sharing invitation, alerting the user
 * on failure
 *
 * @param {InvitationActionParams} params
 * @returns {Promise<void>}
 */
export const declineInvitation = async ({ client, file, showAlert, t }) => {
  try {
    await client.collection(DOCTYPE_FILES).deleteFilePermanently(file._id)
    // FilesRealTimeQueries only forwards deletions from the trash, and a
    // permanent delete skips it, so the store must be told directly
    const deletedFile = { ...file, _deleted: true }
    client.dispatch(
      receiveMutationResult(
        client.generateRandomId(),
        { data: deletedFile },
        {},
        Mutations.deleteDocument(deletedFile)
      )
    )
  } catch (error) {
    logger.error(`Declining sharing invitation ${file._id} failed`, error)
    showAlert({ message: t('alert.try_again'), severity: 'error' })
  }
}
