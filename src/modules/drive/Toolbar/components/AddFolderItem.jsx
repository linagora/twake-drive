import { Icon, FileTypeFolder } from '@linagora/twake-icons'
import React, { useContext } from 'react'
import { connect } from 'react-redux'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { AddMenuContext } from '@/modules/drive/AddMenu/AddMenuProvider'
import { showNewFolderInput } from '@/modules/filelist/duck'

const AddFolderItem = ({ addFolder, onClick, isReadOnly }) => {
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const { onAddFolder } = useContext(AddMenuContext)

  const handleClick = () => {
    if (isReadOnly) {
      showAlert({
        message: t(
          'AddMenu.readOnlyFolder',
          'This is a read-only folder. You cannot perform this action.'
        ),
        severity: 'warning',
        duration: 4000
      })
      onClick()
      return
    }
    if (onAddFolder) {
      onAddFolder()
    } else {
      addFolder()
    }
    onClick()
  }

  return (
    <ActionsMenuItem data-testid="add-folder-link" onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={FileTypeFolder} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_new_folder')} />
    </ActionsMenuItem>
  )
}

const mapDispatchToProps = dispatch => ({
  addFolder: () =>
    setTimeout(() => {
      dispatch(showNewFolderInput())
    }, 0)
})

export default connect(null, mapDispatchToProps)(AddFolderItem)
