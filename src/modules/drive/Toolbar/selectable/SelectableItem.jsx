import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CheckSquareIcon from 'cozy-ui/transpiled/react/Icons/CheckSquare'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

/**
 * Action to show the selection bar
 */
const SelectableItem = ({ onClick }) => {
  const { t } = useI18n()

  return (
    <ActionsMenuItem onClick={onClick}>
      <ListItemIcon>
        <Icon icon={CheckSquareIcon} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_select')} />
    </ActionsMenuItem>
  )
}

SelectableItem.propTypes = {
  onClick: PropTypes.func.isRequired
}

export default SelectableItem
