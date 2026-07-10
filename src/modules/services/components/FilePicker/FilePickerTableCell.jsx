import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React from 'react'

import { isDirectory } from 'cozy-client/dist/models/file'
import Filename from 'cozy-ui/transpiled/react/Filename'
import { useI18n } from 'twake-i18n'

import { getFileNameAndExtension } from '@/modules/filelist/helpers'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'
import { useFormattedUpdatedAt } from '@/modules/filelist/useFormattedUpdatedAt'
import LastUpdate from '@/modules/filelist/virtualized/cells/LastUpdate'
import Size from '@/modules/filelist/virtualized/cells/Size'

const FilePickerNameCell = ({ row }) => {
  const { t } = useI18n()
  const { title, filename, extension } = getFileNameAndExtension(row, t)

  return (
    <div
      data-testid="listitem-onclick"
      className="u-flex u-flex-items-center"
      title={title}
    >
      <div
        data-testid="choice-onclick"
        className="u-flex u-flex-items-center u-flex-shrink-0 u-mr-1"
      >
        <FileThumbnail file={row} />
      </div>
      <div className="u-flex-grow-1 u-ellipsis">
        <Filename filename={filename} extension={extension} midEllipsis />
      </div>
    </div>
  )
}

FilePickerNameCell.propTypes = {
  row: PropTypes.object.isRequired
}

const FilePickerLastUpdateCell = ({ row }) => {
  const updatedAt = row.updated_at || row.created_at
  const formattedUpdatedAt = useFormattedUpdatedAt(updatedAt)

  if (!formattedUpdatedAt) return '—'

  return <LastUpdate date={updatedAt} formatted={formattedUpdatedAt} />
}

FilePickerLastUpdateCell.propTypes = {
  row: PropTypes.object.isRequired
}

const FilePickerSizeCell = ({ row }) => {
  if (isDirectory(row) || !row.size) return '—'

  return <Size filesize={filesize(row.size, { base: 10 })} />
}

FilePickerSizeCell.propTypes = {
  row: PropTypes.object.isRequired
}

export const FilePickerTableCell = ({ column, row }) => {
  if (!column || !row) return null

  if (column.id === 'name') return <FilePickerNameCell row={row} />
  if (column.id === 'updated_at') return <FilePickerLastUpdateCell row={row} />
  if (column.id === 'size') return <FilePickerSizeCell row={row} />

  return null
}

FilePickerTableCell.propTypes = {
  column: PropTypes.shape({
    id: PropTypes.string.isRequired
  }),
  row: PropTypes.object
}
