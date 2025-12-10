import React, { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useQuery } from 'cozy-client'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config.js'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath.jsx'
import { buildSharedDriveIdQuery } from '@/queries'

const SharedDriveBreadcrumb = ({ driveId, folderId }) => {
  const { t } = useI18n()
  const navigate = useNavigate()

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
      if (id === SHARED_DRIVES_DIR_ID) {
        navigate(`/folder/${SHARED_DRIVES_DIR_ID}`)
        return
      }
      navigate(`/shareddrive/${driveId}/${id}`)
    },
    [driveId, navigate]
  )

  return (
    <Breadcrumb
      path={[
        {
          id: SHARED_DRIVES_DIR_ID,
          name: t('breadcrumb.title_shared_drives')
        },
        ...path
      ]}
      onBreadcrumbClick={handleBreadcrumbClick}
      opening={false}
    />
  )
}

export { SharedDriveBreadcrumb }
