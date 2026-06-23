import compose from 'lodash/flowRight'
import PropTypes from 'prop-types'
import React from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import TrashIcon from 'cozy-ui/transpiled/react/Icons/Trash'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { translate } from 'twake-i18n'

import deleteContainer from './delete'

const DeleteItem = ({ t, isSharedWithMe, trashFolder, displayedFolder }) => {
  const handleClick = () => {
    trashFolder(displayedFolder)
  }

  const label = isSharedWithMe ? t('toolbar.leave') : t('toolbar.trash')

  return (
    <ActionsMenuItem data-testid="fil-action-delete" onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={TrashIcon} color="var(--errorColor)" />
      </ListItemIcon>
      <ListItemText style={{ color: 'var(--errorColor)' }} primary={label} />
    </ActionsMenuItem>
  )
}

DeleteItem.propTypes = {
  t: PropTypes.func.isRequired,
  isSharedWithMe: PropTypes.bool.isRequired,
  trashFolder: PropTypes.func.isRequired,
  displayedFolder: PropTypes.object.isRequired
}

export default compose(translate(), deleteContainer)(DeleteItem)
