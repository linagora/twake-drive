import React from 'react'

import DraggableTableRow from './dnd/DraggableTableRow'

import RightClickFileMenu from '@/components/RightClick/RightClickFileMenu'
import { useClipboardContext } from '@/contexts/ClipboardProvider'

const TableRow = ({ item, context, children, ...props }) => {
  const { isItemCut } = useClipboardContext()
  const isCut = isItemCut(item._id)

  return (
    <RightClickFileMenu doc={item} actions={context.actions} {...props}>
      <DraggableTableRow
        item={item}
        context={context}
        isDisabled={isCut}
        data-file-id={item._id}
      >
        {children}
      </DraggableTableRow>
    </RightClickFileMenu>
  )
}

export default React.memo(TableRow)
