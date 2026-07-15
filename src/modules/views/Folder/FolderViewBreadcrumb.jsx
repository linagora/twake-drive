import PropTypes from 'prop-types'
import React, { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import BreadcrumbSkeleton from '@/modules/breadcrumb/components/BreadcrumbSkeleton'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath.jsx'
import { getSharingsTabSearch } from '@/modules/navigation/hooks/helpers'

const FolderViewBreadcrumb = ({
  currentFolderId,
  rootBreadcrumbPath,
  sharedDocumentIds
}) => {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const path = useBreadcrumbPath({
    currentFolderId,
    rootBreadcrumbPath,
    sharedDocumentIds
  })

  const onBreadcrumbClick = useCallback(
    ({ id }) => {
      navigate(
        {
          pathname: id ? `../${id}` : '..',
          // The active sharings tab lives in ?tab= only: keep it when
          // navigating back within the section (empty search elsewhere).
          search: getSharingsTabSearch(pathname, search)
        },
        { relative: 'path' }
      )
    },
    [navigate, pathname, search]
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
