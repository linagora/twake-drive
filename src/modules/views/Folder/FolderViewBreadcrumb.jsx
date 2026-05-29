import PropTypes from 'prop-types'
import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import BreadcrumbSkeleton from '@/modules/breadcrumb/components/BreadcrumbSkeleton'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath.jsx'

const FolderViewBreadcrumb = ({
  currentFolderId,
  rootBreadcrumbPath,
  sharedDocumentIds
}) => {
  const navigate = useNavigate()
  const path = useBreadcrumbPath({
    currentFolderId,
    rootBreadcrumbPath,
    sharedDocumentIds
  })

  const onBreadcrumbClick = useCallback(
    ({ id }) => {
      navigate(id ? `../${id}` : '..', {
        relative: 'path'
      })
    },
    [navigate]
  )

  return path && path.length > 0 ? (
    <Breadcrumb
      path={path}
      onBreadcrumbClick={onBreadcrumbClick}
      opening={false}
    />
  ) : (
    <BreadcrumbSkeleton />
  )
}

FolderViewBreadcrumb.propTypes = {
  currentFolderId: PropTypes.string.isRequired,
  rootBreadcrumbPath: PropTypes.exact({
    id: PropTypes.string,
    name: PropTypes.string
  }).isRequired,
  sharedDocumentIds: PropTypes.array
}

export default FolderViewBreadcrumb
