import { useContext } from 'react'

import { isSharingShortcut } from 'cozy-client/dist/models/file'

import AcceptingSharingContext from '@/lib/AcceptingSharingContext'
import { isReferencedByShareInSharingContext } from '@/modules/views/Folder/syncHelpers'

/**
 * Returns true when a row is a sharing-shortcut whose source is currently
 * being accepted. Several column renderers (`name`, `share`, `menu`) need
 * this flag to disable their interactive bits while a copy is in flight.
 */
export const useIsInSyncFromSharing = row => {
  const { sharingsValue } = useContext(AcceptingSharingContext)
  if (Object.keys(sharingsValue).length === 0) return false
  if (!isSharingShortcut(row)) return false
  return isReferencedByShareInSharingContext(row, sharingsValue)
}
