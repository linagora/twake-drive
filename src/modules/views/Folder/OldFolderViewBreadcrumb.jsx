import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useClient } from 'cozy-client'

import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import logger from '@/lib/logger'
import BreadcrumbSkeleton from '@/modules/breadcrumb/components/BreadcrumbSkeleton'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'

const FolderViewBreadcrumb = ({ sharedDocumentId, getBreadcrumbPath }) => {
  const navigate = useNavigate()
  const client = useClient()
  // Source the folder and its loading state here so the public view does not
  // have to drill them in (it is already a complexity hotspot).
  const { displayedFolder, isLoading: isFolderLoading } = useDisplayedFolder()
  const [path, setPath] = useState(null)
  const [hasError, setHasError] = useState(false)

  // Depend on the folder identity, not the object: getBreadcrumbPath writes to
  // the cozy-client store, which churns the displayedFolder reference and would
  // re-run this effect forever.
  const folderId = displayedFolder?.id
  const folderName = displayedFolder?.name
  const folderDirId = displayedFolder?.dir_id

  useEffect(() => {
    let isMounted = true

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPath(null)
    setHasError(false)
    if (!folderId || !sharedDocumentId) return

    const asyncGetPaths = async () => {
      try {
        const paths = await getBreadcrumbPath({
          client,
          displayedFolder: {
            id: folderId,
            name: folderName,
            dir_id: folderDirId
          },
          sharedDocumentId
        })
        if (isMounted) {
          setPath(paths)
        }
      } catch (error) {
        logger.error(`Error while fetching breadcrumb path: ${error}`)
        if (isMounted) {
          setHasError(true)
        }
      }
    }

    asyncGetPaths()

    return () => {
      isMounted = false
    }
  }, [
    folderId,
    folderName,
    folderDirId,
    sharedDocumentId,
    client,
    getBreadcrumbPath
  ])

  const onBreadcrumbClick = useCallback(
    ({ id }) => {
      navigate(id ? `../${id}` : '..', {
        relative: 'path'
      })
    },
    [navigate]
  )

  if (path) {
    return (
      <Breadcrumb
        path={path}
        onBreadcrumbClick={onBreadcrumbClick}
        opening={false}
      />
    )
  }

  // No resolved path yet. Show the skeleton (to keep the topbar's shape) only
  // while we're still resolving: the folder query is in flight, or it loaded
  // and we're fetching its breadcrumb path. Once the folder request settles
  // without a result (inaccessible / trashed / revoked) or the path fetch
  // fails, render nothing instead of a skeleton that would animate forever.
  const isResolving = isFolderLoading || (Boolean(folderId) && !hasError)
  return isResolving ? <BreadcrumbSkeleton /> : null
}

export default FolderViewBreadcrumb
