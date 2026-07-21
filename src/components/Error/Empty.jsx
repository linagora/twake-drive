import { Icon } from '@linagora/twake-icons'
import cx from 'classnames'
import React from 'react'
import { useLocation } from 'react-router-dom'

import Empty from 'cozy-ui/transpiled/react/Empty'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import styles from './empty.styl'

import FolderEmptyIllu from '@/assets/icons/illu-folder-empty.svg'
import TrashIllustration from '@/assets/icons/illu-trash-empty.svg'
import { TRASH_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import UploadButton from '@/modules/upload/UploadButton'

const EmptyCanvas = ({
  type,
  canUpload,
  localeKey,
  hasTextMobileVersion,
  onUploaded
}) => {
  const { t } = useI18n()
  const { isDesktop } = useBreakpoints()
  const { displayedFolder } = useDisplayedFolder()

  const IconToShow = type === 'trash' ? TrashIllustration : FolderEmptyIllu
  const showUploadLayout = type === 'drive'
  const title = localeKey ? t(`empty.${type}_title`) : undefined
  const text =
    (hasTextMobileVersion && !isDesktop && t(`empty.mobile_text`)) ||
    (localeKey && t(`empty.${localeKey}_text`)) ||
    (showUploadLayout && t('empty.text')) ||
    (type === 'sharing' && t('empty.sharing_text'))

  return (
    <Empty
      className={cx({ [styles['empty']]: showUploadLayout })}
      data-testid="empty-folder"
      icon={
        <div className="u-w-100">
          <Icon icon={IconToShow} size={160} />
        </div>
      }
      iconSize={isDesktop ? 'medium' : 'large'}
      centered={!isDesktop}
      title={title}
      text={
        <>
          {text}
          {showUploadLayout && canUpload !== false && (
            <span className="u-db u-mt-1">
              <UploadButton
                componentsProps={{
                  button: { variant: 'secondary' }
                }}
                label={t('toolbar.menu_upload')}
                displayedFolder={displayedFolder}
                onUploaded={onUploaded}
              />
            </span>
          )}
        </>
      }
    />
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

  if (pathname === '/sharings') {
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
