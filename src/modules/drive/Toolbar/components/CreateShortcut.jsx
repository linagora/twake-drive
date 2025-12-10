import React from 'react'
import { connect } from 'react-redux'
import { useI18n } from 'twake-i18n'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import DeviceBrowserIcon from 'cozy-ui/transpiled/react/Icons/DeviceBrowser'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import ShortcutCreationModal from './ShortcutCreationModal'

import { showModal } from '@/lib/react-cozy-helpers'

const CreateShortcutWrapper = ({ openModal, onClick, isReadOnly }) => {
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
    openModal()
    onClick()
  }

  return (
    <ActionsMenuItem data-testid="create-a-shortcut" onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={DeviceBrowserIcon} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_create_shortcut')} />
    </ActionsMenuItem>
  )
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  openModal: () =>
    dispatch(
      showModal(<ShortcutCreationModal onCreated={ownProps.onCreated} />)
    )
})

export default connect(null, mapDispatchToProps)(CreateShortcutWrapper)
