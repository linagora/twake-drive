import React from 'react'
import { connect } from 'react-redux'
import { useI18n } from 'twake-i18n'

import { useVaultUnlockContext } from 'cozy-keys-lib'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { showNewFolderInput, encryptedFolder } from '@/modules/filelist/duck'
import EncryptedFolderIcon from '@/modules/views/Folder/EncryptedFolderIcon'

const AddEncryptedFolderItem = ({
  addEncryptedFolder,
  onClick,
  isReadOnly
}) => {
  const { t } = useI18n()
  const { showUnlockForm } = useVaultUnlockContext()
  const { showAlert } = useAlert()

  const handleClick = () => {
    if (isReadOnly) {
      showAlert({
        message: t(
          'AddMenu.readOnlyFolder',
          'This is a read-only folder. You cannot perform this action.'
        ),
        severity: 'warning'
      })
      onClick()
      return
    }
    showUnlockForm({ onUnlock: addEncryptedFolder })
    onClick()
  }

  return (
    <ActionsMenuItem
      data-testid="add-encrypted-folder-link"
      onClick={handleClick}
    >
      <ListItemIcon>
        <EncryptedFolderIcon width={16} height={16} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_new_encrypted_folder')} />
    </ActionsMenuItem>
  )
}

const mapDispatchToProps = dispatch => ({
  // An encrypted folder triggers a new encryption key generation
  addEncryptedFolder: () => {
    dispatch(encryptedFolder())
    dispatch(showNewFolderInput())
  }
})

export default connect(null, mapDispatchToProps)(AddEncryptedFolderItem)
