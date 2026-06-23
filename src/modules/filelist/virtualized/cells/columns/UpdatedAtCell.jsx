import React from 'react'

import { useFormattedUpdatedAt } from '@/modules/filelist/useFormattedUpdatedAt'
import LastUpdate from '@/modules/filelist/virtualized/cells/LastUpdate'

const UpdatedAtCell = ({ row, cell }) => {
  const formattedUpdatedAt = useFormattedUpdatedAt(
    row.updated_at || row.created_at
  )
  if (!cell) return '—'
  return <LastUpdate date={cell} formatted={formattedUpdatedAt} />
}

export default UpdatedAtCell
