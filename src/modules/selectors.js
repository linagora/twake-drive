import maxBy from 'lodash/maxBy'

import { getDocumentFromState } from 'cozy-client/dist/store'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import { getMirrorQueryId, parseFolderQueryId } from '@/lib/queries'

export const getFolderContentQueries = (rootState, folderId) => {
  const queries = rootState.cozy.queries
  const folderContentQueries = Object.entries(queries)
    .filter(([queryId]) => {
      const parsed = parseFolderQueryId(queryId)
      if (!parsed) {
        return false
      }
      const { folderId: queryFolderId } = parsed
      if (queryFolderId !== folderId) {
        return false
      }
      return true
    })
    .map(x => x[1])
  return folderContentQueries
}

export const getLatestFolderQueryResults = (rootState, folderId) => {
  const folderContentQueries = getFolderContentQueries(rootState, folderId)
  if (folderContentQueries.length > 0) {
    const mostRecentQueryResults =
      maxBy(folderContentQueries, x => x.lastUpdate) || folderContentQueries[0]
    const otherQueryId = getMirrorQueryId(mostRecentQueryResults.id)
    const otherQueryResults = rootState.cozy.queries[otherQueryId]
    return [mostRecentQueryResults, otherQueryResults]
  }
  return []
}

export const getFolderContent = (rootState, folderId) => {
  const results = getLatestFolderQueryResults(rootState, folderId)
  if (results.length > 0) {
    const [mostRecentQueryResults, otherQueryResults] = results
    const allContent = mostRecentQueryResults.data.concat(
      otherQueryResults ? otherQueryResults.data : []
    )
    return allContent.map(fileId => {
      return getDocumentFromState(rootState, DOCTYPE_FILES, fileId)
    })
  } else {
    return null
  }
}
