import { useEffect, useMemo } from 'react'

import { isQueryLoading, useQuery } from 'cozy-client'

import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import { filterOutReceivedShares } from '@/modules/views/Folder/syncHelpers'

export const useLocalFolderBrowser = ({
  folderId,
  rootBreadcrumbPath,
  sharedDocumentIds,
  buildFolderQuery,
  filterReceivedShares = false,
  allLoaded = true,
  isOwner = () => false,
  onReady,
  isItemDisabled = () => false
}) => {
  const path = useBreadcrumbPath({
    currentFolderId: folderId,
    rootBreadcrumbPath,
    sharedDocumentIds
  })
  const contentFolderQuery = buildFolderQuery(folderId)
  const result = useQuery(
    contentFolderQuery.definition,
    contentFolderQuery.options
  )
  const filteredResult = useMemo(
    () =>
      filterReceivedShares && allLoaded
        ? filterOutReceivedShares([result], isOwner)[0]
        : result,
    [allLoaded, filterReceivedShares, isOwner, result]
  )
  const fetchStatus = isQueryLoading(filteredResult)
    ? 'loading'
    : (filteredResult.fetchStatus ?? 'loaded')

  useEffect(() => {
    if (fetchStatus !== 'loading') onReady?.()
  }, [fetchStatus, onReady])

  return {
    items: filteredResult.data ?? [],
    fetchStatus,
    hasMore: Boolean(filteredResult.hasMore),
    fetchMore: filteredResult.fetchMore ?? null,
    breadcrumbPath: path,
    isItemDisabled
  }
}

export default useLocalFolderBrowser
