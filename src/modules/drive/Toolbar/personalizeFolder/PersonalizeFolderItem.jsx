import React from 'react'
import { useI18n } from 'twake-i18n'

import flag from 'cozy-flags'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import PaletteIcon from 'cozy-ui/transpiled/react/Icons/Palette'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { useModalContext } from '@/lib/ModalContext'
import { FolderCustomizerModal } from '@/modules/views/Folder/FolderCustomizer'

const PersonalizeFolderItem = ({
  displayedFolder,
  hasWriteAccess,
  onClose
}) => {
  const { t } = useI18n()
  const { pushModal, popModal } = useModalContext()

  if (
    !flag('drive.folder-personalization.enabled') ||
    !hasWriteAccess ||
    !displayedFolder ||
    displayedFolder.type !== 'directory'
  ) {
    return null
  }

  const handleClick = () => {
    pushModal(
      <FolderCustomizerModal
        folderId={displayedFolder.id}
        driveId={displayedFolder.driveId}
        onClose={() => {
          popModal()
          onClose?.()
        }}
      />
    )
  }

  return (
    <ActionsMenuItem onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={PaletteIcon} />
      </ListItemIcon>
      <ListItemText primary={t('actions.personalizeFolder.label')} />
    </ActionsMenuItem>
  )
}

export default PersonalizeFolderItem
