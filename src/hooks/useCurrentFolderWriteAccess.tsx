import { useParams } from 'react-router-dom'

import { useSharingContext } from 'cozy-sharing'

import useCurrentFolderId from '@/hooks/useCurrentFolderId'

/**
 * Tells whether the user can write to the current folder.
 *
 * Shared drive folders are proxied from the owner, so the recipient has no local
 * io.cozy.files doc for them. Resolving write access from the route driveId keeps
 * the answer correct where a local folder doc is absent. The folder is treated as
 * writable until the sharing context is loaded, to avoid hiding edit actions on
 * owned folders during the initial load.
 */
const useCurrentFolderWriteAccess = (): boolean => {
  const { driveId } = useParams()
  const folderId = useCurrentFolderId()
  const { hasWriteAccess, allLoaded } = useSharingContext()

  if (!allLoaded || !folderId) {
    return true
  }

  return hasWriteAccess(folderId, driveId)
}

export default useCurrentFolderWriteAccess
