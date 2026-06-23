import { useQuery } from 'cozy-client'

import {
  buildFileOrFolderByIdQuery,
  buildSharedDriveFolderQuery
} from '@/queries'

export const fetchFolder = async ({ client, folderId, driveId }) => {
  const folderQuery = driveId
    ? buildSharedDriveFolderQuery({ driveId, folderId })
    : buildFileOrFolderByIdQuery(folderId)
  const { options, definition } = folderQuery
  const folderQueryResults = await client.fetchQueryAndGetFromState({
    definition: definition(),
    options
  })
  return folderQueryResults.data
}

/**
 * Hook to fetch a folder from cozy stack
 *
 * @param {Object} params - The parameters for the function.
 * @param {string} params.folderId - The ID of the folder to fetch.
 * @param {string} [params.driveId] - The ID of the shared drive to fetch the folder from.
 * @returns {{ folder: import('cozy-client/types/types').IOCozyFolder, fetchStatus: string }} The folder data and the query fetch status.
 */
export const useFolder = ({ folderId, driveId }) => {
  const folderQuery = driveId
    ? buildSharedDriveFolderQuery({ driveId, folderId })
    : buildFileOrFolderByIdQuery(folderId)
  const { options, definition } = folderQuery
  const folderQueryResults = useQuery(definition, options)
  return {
    folder: folderQueryResults.data,
    fetchStatus: folderQueryResults.fetchStatus
  }
}
