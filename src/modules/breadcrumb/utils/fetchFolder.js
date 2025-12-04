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
  return driveId ? folderQueryResults.data?.[0] : folderQueryResults.data
}

/**
 * Hook to fetch a folder from cozy stack
 *
 * @param {Object} params - The parameters for the function.
 * @param {string} params.folderId - The ID of the folder to fetch.
 * @param {string} [params.driveId] - The ID of the shared drive to fetch the folder from.
 * @returns {import('cozy-client/types/types').IOCozyFolder} The folder data.
 */
export const useFolder = ({ folderId, driveId }) => {
  const folderQuery = driveId
    ? buildSharedDriveFolderQuery({ driveId, folderId })
    : buildFileOrFolderByIdQuery(folderId)
  const { options, definition } = folderQuery
  const folderQueryResults = useQuery(definition, options)
  return driveId ? folderQueryResults.data?.[0] : folderQueryResults.data
}
