import { useMemo, useCallback } from 'react'

import { sortFiles } from '../sortFiles'

import { useFolderSort } from '@/hooks'
import { useFileLastUpdated } from '@/modules/filelist/FileLastUpdatedContext'

/**
 * Custom hook for handling file sorting logic
 * @param {string} currentFolderId - The current folder ID
 * @param {Array} queryResults - Query results containing files
 * @param {Object} orderProps - External order properties (optional)
 * @returns {Object} Sorting state and functions
 */
export const useFileSorting = (currentFolderId, queryResults, orderProps) => {
  const { getFileLastUpdatedAt, groupDirectoriesFirstByUpdatedAt } =
    useFileLastUpdated()
  // Get internal sorting state from existing hook
  const [internalSortOrder, internalSetSortOrder, internalIsSettingsLoaded] =
    useFolderSort(currentFolderId)

  // Merge internal and external sort properties
  const sortOrder = orderProps?.sortOrder ?? internalSortOrder
  const setSortOrder = orderProps?.setOrder ?? internalSetSortOrder
  const isSettingsLoaded =
    orderProps?.isSettingsLoaded ?? internalIsSettingsLoaded

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
    return sortFiles(allFiles, sortOrder, {
      getFileLastUpdatedAt,
      groupDirectoriesFirstByUpdatedAt
    })
  }, [
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
