import { useCallback } from 'react'

/**
 * Two refresh handlers the Public view threads through actions, dropzone,
 * keyboard shortcuts, and the `state.refresh` effect. `refreshFolderContent`
 * re-fetches the files query (the public token can't rely on realtime
 * notifications), and `refreshAfterChange` chains the sharing refresh on
 * top so action handlers can use a single callback.
 *
 * Both are memoized so consumers (notably `useKeyboardShortcuts`, whose
 * `handlePaste` callback lists `onPaste` in its deps) don't re-subscribe
 * their event listeners on every render.
 */
export const usePublicRefresh = ({ filesResult, sharingRefresh }) => {
  const refreshFolderContent = useCallback(
    () => filesResult.forceRefetch(),
    [filesResult]
  )
  const refreshAfterChange = useCallback(() => {
    sharingRefresh()
    refreshFolderContent()
  }, [sharingRefresh, refreshFolderContent])
  return { refreshFolderContent, refreshAfterChange }
}
