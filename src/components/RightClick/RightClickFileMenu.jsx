import React from 'react'

import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useRightClick } from '@/components/RightClick/RightClickProvider'
import { getContextMenuActions } from '@/modules/actions/helpers'
import { filterActionsByPolicy } from '@/modules/actions/policies'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const RightClickFileMenu = ({
  doc,
  actions,
  disabled,
  children,
  prefixMenuId,
  ...props
}) => {
  const { position, isOpen, onOpen, onClose } = useRightClick()
  const { isDesktop } = useBreakpoints()
  const { selectedItems, isItemSelected, setSelectedItems, showSelectionBar } =
    useSelectionContext()

  const targetFiles = isItemSelected(doc._id)
    ? Object.values(selectedItems)
    : [doc]

  const contextMenuActions = filterActionsByPolicy(
    getContextMenuActions(actions),
    targetFiles
  )

  if (!children) return null
  if (disabled || !isDesktop)
    return React.Children.map(children, child =>
      React.isValidElement(child)
        ? React.cloneElement(child, {
            ...props
          })
        : null
    )

  return (
    <>
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              ...props,
              onContextMenu: ev => {
                // If the file is not already selected, select it (clearing other selections)
                if (!isItemSelected(doc._id)) {
                  setSelectedItems({ [doc._id]: doc })
                  showSelectionBar()
                }
                onOpen(ev, `${prefixMenuId ?? 'FileMenu'}-${doc._id}`)
                ev.preventDefault()
                ev.stopPropagation()
              }
            })
          : null
      )}
      {isOpen(`${prefixMenuId ?? 'FileMenu'}-${doc._id}`) && (
        <ActionsMenu
          open
          docs={targetFiles}
          actions={contextMenuActions}
          anchorReference="anchorPosition"
          anchorPosition={{ top: position.mouseY, left: position.mouseX }}
          autoClose
          onClose={onClose}
        />
      )}
    </>
  )
}

export default RightClickFileMenu
