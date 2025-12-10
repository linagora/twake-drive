import React, { useMemo, FC, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config.js'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath.jsx'

interface TrashBreadcrumbProps {
  currentFolderId: string
}

const TrashBreadcrumb: FC<TrashBreadcrumbProps> = ({ currentFolderId }) => {
  const { t } = useI18n()
  const navigate = useNavigate()

  const rootBreadcrumbPath = useMemo(
    () => ({
      id: TRASH_DIR_ID,
      name: t('breadcrumb.title_trash')
    }),
    [t]
  )

  const path = useBreadcrumbPath({
    currentFolderId,
    rootBreadcrumbPath
  })

  const trashPath = [
    {
      id: ROOT_DIR_ID,
      name: t('breadcrumb.title_drive')
    },
    ...path
  ]

  const handleBreadcrumbClick = useCallback(
    ({ id }: { id: string }) => {
      // We can navigate to the root folder inside the breadcrumb
      if (id === ROOT_DIR_ID) {
        navigate(`/folder/${ROOT_DIR_ID}`)
      } else {
        navigate(`/trash/${id}`)
      }
    },
    [navigate]
  )

  return (
    <Breadcrumb
      path={trashPath}
      onBreadcrumbClick={handleBreadcrumbClick}
      opening={false}
    />
  )
}

export { TrashBreadcrumb }
