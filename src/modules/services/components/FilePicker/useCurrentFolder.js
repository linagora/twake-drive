import { useQuery, hasQueryBeenLoaded } from 'cozy-client'

import { buildCurrentFolderQuery } from './queries'

/**
 * Fetches the io.cozy.files doc of the folder currently displayed by
 * the picker.
 *
 * Shared by the picker dialog (mobile back navigation) and its header
 * (breadcrumb): both read the same `onlyfolder-<id>` query slice, so
 * cozy-client dedups the fetch.
 *
 * @param {string} folderId - io.cozy.files id of the current folder
 * @returns {{displayedFolder: object|null, hasLoaded: boolean}}
 */
export const useCurrentFolder = folderId => {
  const currentFolderQuery = buildCurrentFolderQuery(folderId)
  const { data, ...queryResult } = useQuery(
    currentFolderQuery.definition,
    currentFolderQuery.options
  )

  return {
    displayedFolder: (Array.isArray(data) ? data[0] : data) ?? null,
    hasLoaded: hasQueryBeenLoaded(queryResult)
  }
}
