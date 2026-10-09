import { Icon, Upload } from '@linagora/twake-icons'
import React from 'react'
import { useLocation } from 'react-router-dom'

import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import styles from './empty.styl'

import DriveEmptyIllu from '@/assets/icons/illu-drive-empty.svg'
import { TRASH_DIR_ID } from '@/constants/config'
import { useCurrentFolderId, useDisplayedFolder } from '@/hooks'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import { UploadButton } from '@/modules/upload/UploadButton'
import { isSharingsTabRootRoute } from '@/modules/views/Sharings/routes'

const EmptyCanvas = ({
  type,
  canUpload,
  localeKey,
  hasTextMobileVersion,
  onUploaded,
  driveId
}) => {
  const { t } = useI18n()
  const { isDesktop } = useBreakpoints()
  const folderId = useCurrentFolderId()
  const { displayedFolder } = useDisplayedFolder()
  const { sharedDriveResult } = useSharedDriveFolder({ driveId, folderId })
  const displayedSharedFolder = sharedDriveResult?.data

  const showUploadLayout = type === 'drive'
  const title =
    (localeKey && t(`empty.${type}_title`)) ||
    (hasTextMobileVersion && !isDesktop && t('empty.mobile_text')) ||
    (showUploadLayout && t('empty.text')) ||
    (type === 'sharing' && t('empty.sharing_text'))

  return (
    <div className={styles['empty']} data-testid="empty-folder">
      <Icon icon={DriveEmptyIllu} size={200} />
      <Typography variant="h3" className={styles['empty-title']}>
        {title}
      </Typography>
      {showUploadLayout && canUpload !== false && (
        <UploadButton
          componentsProps={{
            button: {
              style: {
                color: 'var(--primaryTextColor)',
                backgroundColor: 'var(--primaryColorLight)'
              },
              startIcon: undefined,
              endIcon: <Icon icon={Upload} size={18} />
            }
          }}
          label={t('toolbar.menu_upload')}
          displayedFolder={displayedSharedFolder || displayedFolder}
          onUploaded={onUploaded}
        />
      )}
    </div>
  )
}

export default EmptyCanvas

export const EmptyDrive = props => {
  return <EmptyCanvas type="drive" hasTextMobileVersion {...props} />
}

export const EmptyTrash = props => (
  <EmptyCanvas type="trash" localeKey="trash" {...props} />
)

export const EmptyWrapper = ({
  currentFolderId,
  canUpload,
  refreshFolderContent,
  driveId
}) => {
  const { pathname } = useLocation()

  if (isSharingsTabRootRoute(pathname)) {
    return <EmptyCanvas type="sharing" driveId={driveId} />
  }
  if (currentFolderId !== TRASH_DIR_ID) {
    return (
      <EmptyDrive
        canUpload={canUpload}
        onUploaded={refreshFolderContent}
        driveId={driveId}
      />
    )
  }

  return <EmptyTrash canUpload={canUpload} onUploaded={refreshFolderContent} />
}
