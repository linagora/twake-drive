import { useQuery } from 'cozy-client'

import { DEFAULT_SORT } from '@/config/sort'
import { buildDriveQuery } from '@/queries'

const resolveFolderSort = sortOrder =>
  sortOrder.attribute === 'size' ? DEFAULT_SORT : sortOrder

const fetchStatusMatches = (results, predicate) => results.some(predicate)

/**
 * Runs the directory + file queries for the Drive view and folds their
 * `fetchStatus` into the three derived flags the view needs.
 *
 * The directory query overrides a `size` sort with `DEFAULT_SORT`, since
 * sorting directories by size has no meaningful definition.
 */
export const useDriveQueries = (currentFolderId, sortOrder) => {
  const folderSort = resolveFolderSort(sortOrder)
  const folderQuery = buildDriveQuery({
    currentFolderId,
    type: 'directory',
    sortAttribute: folderSort.attribute,
    sortOrder: folderSort.order
  })
  const fileQuery = buildDriveQuery({
    currentFolderId,
    type: 'file',
    sortAttribute: sortOrder.attribute,
    sortOrder: sortOrder.order
  })
  const foldersResult = useQuery(folderQuery.definition, folderQuery.options)
  const filesResult = useQuery(fileQuery.definition, fileQuery.options)

  const allResults = [foldersResult, filesResult]
  return {
    allResults,
    isInError: fetchStatusMatches(allResults, r => r.fetchStatus === 'failed'),
    isLoading: fetchStatusMatches(
      allResults,
      r => r.fetchStatus === 'loading' && !r.lastUpdate
    ),
    isPending: fetchStatusMatches(allResults, r => r.fetchStatus === 'pending')
  }
}
