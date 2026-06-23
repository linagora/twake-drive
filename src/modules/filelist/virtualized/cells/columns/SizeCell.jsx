import { filesize } from 'filesize'
import React from 'react'

import { isDirectory } from 'cozy-client/dist/models/file'

import Size from '@/modules/filelist/virtualized/cells/Size'

const SizeCell = ({ row, cell }) => {
  if (!cell) return '—'
  const formattedSize =
    !isDirectory(row) && row.size ? filesize(row.size, { base: 10 }) : undefined
  return <Size filesize={formattedSize} />
}

export default SizeCell
