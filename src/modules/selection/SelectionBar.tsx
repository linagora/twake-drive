import React from 'react'

import ActionsBar from 'cozy-ui/transpiled/react/ActionsBar'

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
  const { isSelectionBarVisible, hideSelectionBar, selectedItems } =
    useSelectionContext()

  if (isSelectionBarVisible && actions) {
    let convertedActions = driveActionsToSelectionBarActions(actions)

    const hasInfectedItem = selectedItems.some(item => isInfected(item))
    if (hasInfectedItem) {
      convertedActions = convertedActions.filter(driveAction => {
        const actionName = Object.keys(driveAction)[0]
        return actionName === 'trash'
      })
    }

    return (
      <ActionsBar
        actions={convertedActions}
        docs={selectedItems}
        onClose={hideSelectionBar}
        autoClose={autoClose}
      />
    )
  }

  return null
}

export default SelectionBar
