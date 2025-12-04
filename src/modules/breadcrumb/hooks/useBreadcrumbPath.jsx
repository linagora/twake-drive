import { useEffect, useState } from 'react'

import { useClient } from 'cozy-client'
import log from 'cozy-logger'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { fetchFolder, useFolder } from '@/modules/breadcrumb/utils/fetchFolder'

/**
 * @typedef {Object} BreadcrumbPath
 * @property {string} name - The name of the folder.
 * @property {string} id - The ID of the folder.
 */

/**
 * Custom hook that retrieves the breadcrumb path for a given folder.
 *
 * @param {Object} options - The options for retrieving the breadcrumb path.
 * @param {string} options.currentFolderId - The ID of the current folder.
 * @param {BreadcrumbPath} options.rootBreadcrumbPath - The root breadcrumb path object.
 * @param {string[]} [options.sharedDocumentIds] - The IDs of shared documents.
 * @returns {BreadcrumbPath[]} - The breadcrumb path as an array of objects.
 */
export const useBreadcrumbPath = ({
  currentFolderId,
  rootBreadcrumbPath,
  sharedDocumentIds,
  driveId
}) => {
  const client = useClient()
  const [paths, setPaths] = useState([])

  const folder = useFolder({ folderId: currentFolderId, driveId })
  const folderAttributes = {
    id: folder?.id,
    name: folder?.name,
    dirId: folder?.dir_id
  }

  useEffect(() => {
    if (!folderAttributes.id || !folderAttributes.name) return

    const hasAccessToSharedDocument = id => {
      if (!sharedDocumentIds) return true
      return !sharedDocumentIds.includes(id)
    }

    let isSubscribed = true
    const returnedPaths = [
      { name: folderAttributes.name, id: folderAttributes.id }
    ]

    const fetchBreadcrumbs = async () => {
      let id = folderAttributes.dirId
      while (
        !!id &&
        id !== rootBreadcrumbPath.id &&
        id !== SHARED_DRIVES_DIR_ID
      ) {
        const folder = await fetchFolder({ client, driveId, folderId: id })
        if (!folder) {
          id = undefined
        } else {
          returnedPaths.unshift({ name: folder.name, id: folder.id })
          id = hasAccessToSharedDocument(folder.id) ? folder.dir_id : undefined
        }
      }

      if (isSubscribed) {
        const shouldAddRoot =
          rootBreadcrumbPath.name !== 'Public' &&
          returnedPaths[0]?.id !== rootBreadcrumbPath.id
        if (shouldAddRoot) {
          returnedPaths.unshift(rootBreadcrumbPath)
        }
        setPaths(returnedPaths)
      }
    }

    fetchBreadcrumbs().catch(error => {
      if (rootBreadcrumbPath && rootBreadcrumbPath.name === 'Public') {
        if (isSubscribed) {
          setPaths(returnedPaths)
        }
      } else {
        if (isSubscribed && rootBreadcrumbPath) {
          setPaths([rootBreadcrumbPath])
        }
        log(
          'error',
          `Error while fetching folder for breadcrumbs of folder id: ${folderAttributes.id}, here is the error: ${error}`
        )
      }
    })

    return () => {
      isSubscribed = false
    }
  }, [
    client,
    sharedDocumentIds,
    rootBreadcrumbPath,
    driveId,
    folderAttributes.id,
    folderAttributes.name,
    folderAttributes.dirId
  ])

  return paths
}
