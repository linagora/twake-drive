import React, { useRef, useState } from 'react'
import { useI18n } from 'twake-i18n'

import ActionsBar from 'cozy-ui/transpiled/react/ActionsBar'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import ShieldCleanIcon from 'cozy-ui/transpiled/react/Icons/ShieldClean'
import List from 'cozy-ui/transpiled/react/List'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Popover from 'cozy-ui/transpiled/react/Popover'

import { isInfected } from '@/modules/filelist/helpers'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

type DriveAction = Record<
  string,
  {
    displayInSelectionBar?: boolean
  }
>

const driveActionsToSelectionBarActions = (
  driveActions: DriveAction[]
): DriveAction[] => {
  return driveActions.filter(driveAction => {
    const action = Object.values(driveAction)[0]
    return (
      action.displayInSelectionBar === undefined || action.displayInSelectionBar
    )
  })
}

const SelectionBar: React.FC<{
  actions?: DriveAction[]
  autoClose?: boolean
}> = ({ actions, autoClose = false }) => {
  const { t } = useI18n()
  const { isSelectionBarVisible, hideSelectionBar, selectedItems } =
    useSelectionContext()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const handlePopoverOpen = (): void => {
    setPopoverOpen(true)
  }

  const handlePopoverClose = (): void => {
    setPopoverOpen(false)
  }

  if (isSelectionBarVisible && actions) {
    let convertedActions = driveActionsToSelectionBarActions(actions)

    let color = 'default'
    let iconComponent = null
    const hasInfectedItem = selectedItems.some(item => isInfected(item))
    if (hasInfectedItem) {
      convertedActions = convertedActions.filter(driveAction => {
        const actionName = Object.keys(driveAction)[0]
        return actionName === 'trash'
      })
      color = 'error'
      iconComponent = (): JSX.Element => (
        <div onMouseEnter={handlePopoverOpen} onMouseLeave={handlePopoverClose}>
          <IconButton ref={anchorRef}>
            <Icon color="white" icon="info-outlined" className="u-mr-1" />
          </IconButton>
          <Popover
            open={popoverOpen}
            anchorEl={anchorRef.current}
            onClose={handlePopoverClose}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'left'
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'right'
            }}
          >
            <Paper elevation={8} className="u-maw-6">
              <List>
                <ListItem ellipsis={false}>
                  <ListItemIcon>
                    <Icon icon={ShieldCleanIcon} color="var(--primaryColor)" />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('antivirus.popover.title')}
                    secondary={t('antivirus.popover.description')}
                  />
                </ListItem>
              </List>
            </Paper>
          </Popover>
        </div>
      )
    }

    return (
      <ActionsBar
        actions={convertedActions}
        docs={selectedItems}
        onClose={hideSelectionBar}
        autoClose={autoClose}
        color={color}
        IconComponent={iconComponent}
      />
    )
  }

  return null
}

export default SelectionBar
