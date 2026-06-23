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

  const { folder, fetchStatus } = useFolder({
    folderId: currentFolderId,
    driveId
  })
  const folderAttributes = {
    id: folder?.id,
    name: folder?.name,
    dirId: folder?.dir_id
  }

  useEffect(() => {
    if (rootBreadcrumbPath && currentFolderId === rootBreadcrumbPath.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaths([rootBreadcrumbPath])
      return
    }

    if (!folderAttributes.id || !folderAttributes.name) {
      // While the folder query is in flight we keep the path empty so the
      // breadcrumb can show its loading skeleton. Once the query has settled
      // without a usable folder (inaccessible or deleted target), fall back to
      // the root so the skeleton doesn't spin forever.
      const isSettled = fetchStatus === 'loaded' || fetchStatus === 'failed'
      setPaths(isSettled && rootBreadcrumbPath ? [rootBreadcrumbPath] : [])
      return
    }

    const hasAccessToSharedDocument = id => {
      if (!sharedDocumentIds) return true
      return !sharedDocumentIds.includes(id)
    }

    let isSubscribed = true
    const returnedPaths = [
      { name: folderAttributes.name, id: folderAttributes.id }
    ]

    const shouldContinueLoop = id => {
      return (
        !!id && id !== rootBreadcrumbPath?.id && id !== SHARED_DRIVES_DIR_ID
      )
    }

    const processFolder = async id => {
      const folder = await fetchFolder({ client, driveId, folderId: id })
      if (!folder) return undefined

      returnedPaths.unshift({ name: folder.name, id: folder.id })
      return hasAccessToSharedDocument(folder.id) ? folder.dir_id : undefined
    }

    const shouldAddRootPath = () => {
      return (
        rootBreadcrumbPath?.name !== 'Public' &&
        returnedPaths[0]?.id !== rootBreadcrumbPath.id
      )
    }

    const handleBreadcrumbError = error => {
      if (rootBreadcrumbPath?.name === 'Public') {
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
    }

    const fetchBreadcrumbs = async () => {
      let id = folderAttributes.dirId
      while (shouldContinueLoop(id)) {
        id = await processFolder(id)
      }

      if (isSubscribed) {
        if (shouldAddRootPath()) {
          returnedPaths.unshift(rootBreadcrumbPath)
        }
        setPaths(returnedPaths)
      }
    }

    fetchBreadcrumbs().catch(handleBreadcrumbError)

    return () => {
      isSubscribed = false
    }
  }, [
    client,
    sharedDocumentIds,
    rootBreadcrumbPath,
    driveId,
    fetchStatus,
    folderAttributes.id,
    folderAttributes.name,
    folderAttributes.dirId,
    currentFolderId
  ])

  return paths
}
