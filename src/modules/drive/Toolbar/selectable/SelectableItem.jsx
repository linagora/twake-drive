import { Icon, CheckSquare } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useI18n } from 'twake-i18n'

/**
 * Action to show the selection bar
 */
const SelectableItem = ({ onClick }) => {
  const { t } = useI18n()

  return (
    <ActionsMenuItem onClick={onClick}>
      <ListItemIcon>
        <Icon icon={CheckSquare} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_select')} />
    </ActionsMenuItem>
  )
}

SelectableItem.propTypes = {
  onClick: PropTypes.func.isRequired
}

export default SelectableItem
