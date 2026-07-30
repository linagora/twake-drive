import React from 'react'

import { useFileLastUpdated } from '@/modules/filelist/FileLastUpdatedContext'
import { useFormattedUpdatedAt } from '@/modules/filelist/useFormattedUpdatedAt'
import LastUpdate from '@/modules/filelist/virtualized/cells/LastUpdate'

const UpdatedAtCell = ({ row }) => {
  const { getFileLastUpdatedAt } = useFileLastUpdated()
  const updatedAt = getFileLastUpdatedAt(row)
  const formattedUpdatedAt = useFormattedUpdatedAt(updatedAt)
  if (!updatedAt) return '—'
  return <LastUpdate date={updatedAt} formatted={formattedUpdatedAt} />
}

export default UpdatedAtCell
