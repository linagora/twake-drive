import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useClient } from 'cozy-client'

import logger from '@/lib/logger'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'

const FolderViewBreadcrumb = ({
  displayedFolder,
  sharedDocumentId,
  getBreadcrumbPath
}) => {
  const navigate = useNavigate()
  const client = useClient()
  const [path, setPath] = useState(null)

  useEffect(() => {
    let isMounted = true

    setPath(null)
    if (!displayedFolder || !sharedDocumentId) return

    const asyncGetPaths = async () => {
      try {
        const paths = await getBreadcrumbPath({
          client,
          displayedFolder,
          sharedDocumentId
        })
        if (isMounted) {
          setPath(paths)
        }
      } catch (error) {
        logger.error(`Error while fetching breadcrumb path: ${error}`)
        if (isMounted) {
          setPath(null)
        }
      }
    }

    asyncGetPaths()

    return () => {
      isMounted = false
    }
  }, [displayedFolder, sharedDocumentId, client, getBreadcrumbPath])

  const onBreadcrumbClick = useCallback(
    ({ id }) => {
      navigate(id ? `../${id}` : '..', {
        relative: 'path'
      })
    },
    [navigate]
  )

  return path ? (
    <Breadcrumb
      path={path}
      onBreadcrumbClick={onBreadcrumbClick}
      opening={false}
    />
  ) : null
}

export default FolderViewBreadcrumb
