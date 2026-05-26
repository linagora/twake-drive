import { useCallback } from 'react'

/**
 * Two refresh handlers the Public view threads through actions, dropzone,
 * keyboard shortcuts, and the `state.refresh` effect. `refreshFolderContent`
 * re-fetches the files query (the public token can't rely on realtime
 * notifications), and `refreshAfterChange` chains the sharing refresh on
 * top so action handlers can use a single callback.
 */
export const usePublicRefresh = ({ filesResult, sharingRefresh }) => {
  const refreshFolderContent = useCallback(
    () => filesResult.forceRefetch(),
    [filesResult]
  )
  const refreshAfterChange = () => {
    sharingRefresh()
    refreshFolderContent()
  }
  return { refreshFolderContent, refreshAfterChange }
}
