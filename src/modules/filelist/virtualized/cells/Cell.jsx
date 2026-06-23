import React from 'react'

import MenuCell from './columns/MenuCell'
import NameCell from './columns/NameCell'
import ShareCell from './columns/ShareCell'
import SizeCell from './columns/SizeCell'
import TempDirectoryCell from './columns/TempDirectoryCell'
import UpdatedAtCell from './columns/UpdatedAtCell'

const RENDERERS = {
  name: NameCell,
  updated_at: UpdatedAtCell,
  size: SizeCell,
  share: ShareCell,
  menu: MenuCell
}

const Cell = props => {
  if (props.row.type === 'tempDirectory') {
    return <TempDirectoryCell {...props} />
  }
  const Renderer = RENDERERS[props.column.id]
  if (!Renderer) return <>{props.cell}</>
  return <Renderer {...props} />
}

const CellMemo = React.memo(Cell)

const CellWrapper = props => <CellMemo {...props} />

export default CellWrapper
