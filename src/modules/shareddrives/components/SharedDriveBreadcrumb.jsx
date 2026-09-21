import React, { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import { useI18n } from 'twake-i18n'

import { SHARINGS_VIEW_ID } from '@/constants/config'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath.jsx'
import { getSharingsRootRoute } from '@/modules/views/Sharings/routes'
import { buildSharedDriveIdQuery } from '@/queries'

const SharedDriveBreadcrumb = ({ driveId, folderId }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const sharedDriveQuery = buildSharedDriveIdQuery({ driveId })
  const { data: sharedDrive } = useQuery(
    sharedDriveQuery.definition,
    sharedDriveQuery.options
  )

  const rootBreadcrumbPath = useMemo(
    () => ({
      id: sharedDrive?.rules?.[0]?.values?.[0],
      name: sharedDrive?.description
    }),
    [sharedDrive]
  )

  const path = useBreadcrumbPath({
    currentFolderId: folderId,
    rootBreadcrumbPath,
    driveId
  })

  const handleBreadcrumbClick = useCallback(
    ({ id }) => {
      if (id === SHARINGS_VIEW_ID) {
        navigate(getSharingsRootRoute(pathname))
        return
      }
      navigate(`/shareddrive/${driveId}/${id}`)
    },
    [driveId, navigate, pathname]
  )

  return (
    <Breadcrumb
      path={[
        {
          id: SHARINGS_VIEW_ID,
          name: t('breadcrumb.title_sharings')
        },
        ...path
      ]}
      onBreadcrumbClick={handleBreadcrumbClick}
      opening={false}
    />
  )
}

export { SharedDriveBreadcrumb }
