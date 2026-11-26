import React, { useReducer, useRef } from 'react'

import { useIsInSyncFromSharing } from './useIsInSyncFromSharing'

import { ActionMenuWithHeader } from '@/modules/actionmenu/ActionMenuWithHeader'
import { getItemContextMenuActions } from '@/modules/actions/helpers'
import { canInteractWithItem } from '@/modules/filelist/helpers'
import FileAction from '@/modules/filelist/virtualized/cells/FileAction'

const MenuCell = ({ row, actions }) => {
  const filerowMenuToggleRef = useRef()
  const [showActionMenu, toggleShowActionMenu] = useReducer(
    state => !state,
    false
  )
  const isInSyncFromSharing = useIsInSyncFromSharing(row)

  if (!actions?.length || !canInteractWithItem(row)) return null

  const contextMenuActions = getItemContextMenuActions(actions, row)
  if (contextMenuActions.length === 0) return null

  return (
    <>
      <FileAction
        file={row}
        ref={filerowMenuToggleRef}
        disabled={isInSyncFromSharing}
        onClick={event => {
          event.stopPropagation()
          toggleShowActionMenu()
        }}
      />
      {showActionMenu && (
        <ActionMenuWithHeader
          file={row}
          anchorElRef={filerowMenuToggleRef}
          actions={contextMenuActions}
          onClose={toggleShowActionMenu}
        />
      )}
    </>
  )
}

export default MenuCell
