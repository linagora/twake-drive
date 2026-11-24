import React, { useReducer, useRef } from 'react'

import { useIsInSyncFromSharing } from './useIsInSyncFromSharing'

import { ActionMenuWithHeader } from '@/modules/actionmenu/ActionMenuWithHeader'
import { getContextMenuActions } from '@/modules/actions/helpers'
import { filterActionsByPolicy } from '@/modules/actions/policies'
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

  const contextMenuActions = getContextMenuActions(
    filterActionsByPolicy(actions, [row])
  )

  return (
    <>
      <FileAction
        file={row}
        ref={filerowMenuToggleRef}
        disabled={isInSyncFromSharing}
        onClick={toggleShowActionMenu}
      />
      {contextMenuActions && showActionMenu && (
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
