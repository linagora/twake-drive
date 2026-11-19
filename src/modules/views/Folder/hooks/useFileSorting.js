import { useMemo, useCallback } from 'react'

import { sortFiles } from '../sortFiles'

import { useFolderSort } from '@/hooks'
import { useFileLastUpdated } from '@/modules/filelist/FileLastUpdatedContext'

/**
 * Custom hook for handling file sorting logic
 * @param {string} currentFolderId - The current folder ID
 * @param {Array} queryResults - Query results containing files
 * @param {Object} orderProps - External order properties (optional),
 * `keepQueryOrder` keeps the order of the query results
 * @returns {Object} Sorting state and functions
 */
export const useFileSorting = (currentFolderId, queryResults, orderProps) => {
  const keepQueryOrder = orderProps?.keepQueryOrder ?? false
  const { getFileLastUpdatedAt, groupDirectoriesFirstByUpdatedAt } =
    useFileLastUpdated()
  // Get internal sorting state from existing hook
  const [internalSortOrder, internalSetSortOrder, internalIsSettingsLoaded] =
    useFolderSort(currentFolderId)

  // Merge internal and external sort properties
  const sortOrder = orderProps?.sortOrder ?? internalSortOrder
  const setSortOrder = orderProps?.setOrder ?? internalSetSortOrder
  // getFolderViewState shows the loading state only while this is false:
  // without sorting, the list waits for its query, not for sort settings.
  const isSettingsLoaded = keepQueryOrder
    ? false
    : (orderProps?.isSettingsLoaded ?? internalIsSettingsLoaded)

  // Extract all files from query results
  const allFiles = useMemo(() => {
    const files = []
    queryResults.forEach(query => {
      if (query.data && query.data.length > 0) {
        files.push(...query.data)
      }
    })
    return files
  }, [queryResults])

  // Sort files based on current sort order
  const sortedFiles = useMemo(() => {
    if (keepQueryOrder) return allFiles
    return sortFiles(allFiles, sortOrder, {
      getFileLastUpdatedAt,
      groupDirectoriesFirstByUpdatedAt
    })
  }, [
    keepQueryOrder,
    allFiles,
    sortOrder,
    getFileLastUpdatedAt,
    groupDirectoriesFirstByUpdatedAt
  ])

  // Create sort change handler
  const changeSortOrder = useCallback(
    (_, attribute, order) => setSortOrder({ attribute, order }),
    [setSortOrder]
  )

  return {
    sortOrder,
    setSortOrder,
    isSettingsLoaded,
    allFiles,
    sortedFiles,
    changeSortOrder
  }
}
