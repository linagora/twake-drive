import React, { forwardRef } from 'react'

import flag from 'cozy-flags'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import TextIcon from 'cozy-ui/transpiled/react/Icons/Text'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { isFileSummaryCompatible } from 'cozy-viewer/dist/helpers'

const makeComponent = (label, icon) => {
  const Component = forwardRef((props, ref) => {
    return (
      <ActionsMenuItem {...props} ref={ref}>
        <ListItemIcon>
          <Icon icon={icon} />
        </ListItemIcon>
        <ListItemText primary={label} />
      </ActionsMenuItem>
    )
  })

  Component.displayName = 'summariseByAI'

  return Component
}

export const summariseByAI = ({ t, hasWriteAccess, navigate }) => {
  const label = t('actions.summariseByAI')
  const icon = TextIcon

  return {
    name: 'summariseByAI',
    label,
    icon,
    displayCondition: files =>
      flag('ai.available') &&
      isFileSummaryCompatible(files[0]) &&
      hasWriteAccess,
    action: files => {
      const file = files[0]
      navigate(`file/${file._id}`, {
        state: { showAIAssistant: true }
      })
    },
    Component: makeComponent(label, icon)
  }
}
