import React from 'react'
import { connect } from 'react-redux'
import { useI18n } from 'twake-i18n'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconFolder from 'cozy-ui/transpiled/react/Icons/FileTypeFolder'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { showNewFolderInput } from '@/modules/filelist/duck'

const AddFolderItem = ({ addFolder, onClick, isReadOnly }) => {
  const { t } = useI18n()
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
    addFolder()
    onClick()
  }

  return (
    <ActionsMenuItem data-testid="add-folder-link" onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={IconFolder} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_new_folder')} />
    </ActionsMenuItem>
  )
}

const mapDispatchToProps = dispatch => ({
  addFolder: () => dispatch(showNewFolderInput())
})

export default connect(null, mapDispatchToProps)(AddFolderItem)
