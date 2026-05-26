import React, { useReducer, useRef } from 'react'

import { useIsInSyncFromSharing } from './useIsInSyncFromSharing'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { ActionMenuWithHeader } from '@/modules/actionmenu/ActionMenuWithHeader'
import { getContextMenuActions } from '@/modules/actions/helpers'
import { filterActionsByPolicy } from '@/modules/actions/policies'
import FileAction from '@/modules/filelist/virtualized/cells/FileAction'

const canInteractWithRow = row =>
  row._id && row._id !== SHARED_DRIVES_DIR_ID && !row._id.endsWith('.trash-dir')

const MenuCell = ({ row, actions }) => {
  const filerowMenuToggleRef = useRef()
  const [showActionMenu, toggleShowActionMenu] = useReducer(
    state => !state,
    false
  )
  const isInSyncFromSharing = useIsInSyncFromSharing(row)

  if (!actions || !canInteractWithRow(row)) return null

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
