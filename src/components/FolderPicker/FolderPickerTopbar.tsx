import cx from 'classnames'
import React, { useCallback, useState } from 'react'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import FolderAddIcon from 'cozy-ui/transpiled/react/Icons/FolderAdd'
import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { getParentFolder } from './helpers'

import BackButton from '@/components/Button/BackButton'
import { File } from '@/components/FolderPicker/types'
import { ROOT_DIR_ID } from '@/constants/config'
import { useNextcloudInfos } from '@/modules/nextcloud/hooks/useNextcloudInfos'

interface FolderPickerTopbarProps {
  navigateTo: (folder: import('./types').File) => void
  folder: File
  showFolderCreation?: () => void
  canCreateFolder?: boolean
}

const FolderPickerTopbar: React.FC<FolderPickerTopbarProps> = ({
  navigateTo,
  folder,
  showFolderCreation,
  canCreateFolder
}) => {
  const { t } = useI18n()
  const client = useClient()
  const { isMobile } = useBreakpoints()
  const [isNavigating, setNavigating] = useState(false)

  const showBackButton = folder._id !== ROOT_DIR_ID

  const { instanceName } = useNextcloudInfos({
    sourceAccount: folder.cozyMetadata?.sourceAccount
  })

  const handleNavigateTo = useCallback(async () => {
    setNavigating(true)
    const parentFolder = await getParentFolder(client, folder, {
      instanceName
    })
    navigateTo(parentFolder)
    setNavigating(false)
  }, [client, folder, navigateTo, instanceName])

  const name =
    folder._id === ROOT_DIR_ID ? t('breadcrumb.title_drive') : folder.name

  const showCreateFolderButton =
    canCreateFolder && folder._type !== 'io.cozy.remote.nextcloud.files'

  return (
    <div
      style={{ height: '3rem' }}
      className={cx('u-flex u-flex-items-center', !isMobile ? 'u-mh-1' : '')}
    >
      {showBackButton ? (
        <BackButton onClick={handleNavigateTo} disabled={isNavigating} />
      ) : null}
      <Typography variant="h4" className={!showBackButton ? 'u-ml-1' : ''}>
        {name}
      </Typography>
      {showCreateFolderButton ? (
        <IconButton
          className="u-ml-auto"
          onClick={showFolderCreation}
          aria-label={t('Move.addFolder')}
        >
          <Icon icon={FolderAddIcon} />
        </IconButton>
      ) : null}
    </div>
  )
}

export { FolderPickerTopbar }
