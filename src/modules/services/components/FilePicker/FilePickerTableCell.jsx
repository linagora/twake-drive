import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React from 'react'

import { isDirectory } from 'cozy-client/dist/models/file'
import Checkbox from 'cozy-ui/transpiled/react/Checkbox'
import Filename from 'cozy-ui/transpiled/react/Filename'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import {
  getFileNameAndExtension,
  makeFileMetadata
} from '@/modules/filelist/helpers'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'
import { useFormattedUpdatedAt } from '@/modules/filelist/useFormattedUpdatedAt'
import SizeCell from '@/modules/filelist/virtualized/cells/columns/SizeCell'
import UpdatedAtCell from '@/modules/filelist/virtualized/cells/columns/UpdatedAtCell'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const FilePickerNameCell = ({ row, selectionModeActive }) => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const { isItemSelected } = useSelectionContext()
  const { title, filename, extension } = getFileNameAndExtension(row, t)
  const isFolder = isDirectory(row)
  const formattedUpdatedAt = useFormattedUpdatedAt(
    row.updated_at || row.created_at
  )
  const formattedSize =
    !isFolder && row.size !== null && row.size !== undefined
      ? filesize(row.size, { base: 10 })
      : null
  const metadata =
    isMobile && !isFolder
      ? makeFileMetadata(formattedUpdatedAt ?? '—', formattedSize ?? '—')
      : null

  return (
    <div
      data-testid="listitem-onclick"
      className="u-flex u-flex-items-center"
      title={title}
    >
      {isMobile && selectionModeActive && (
        <Checkbox
          checked={isItemSelected(row._id)}
          size="medium"
          onChange={() => {}}
        />
      )}
      <div
        data-testid="choice-onclick"
        className="u-flex u-flex-items-center u-flex-shrink-0 u-mr-1"
      >
        <FileThumbnail file={row} />
      </div>
      <div className="u-flex-grow-1 u-ellipsis">
        <Filename
          filename={filename}
          extension={extension}
          midEllipsis
          path={metadata}
        />
      </div>
    </div>
  )
}

FilePickerNameCell.propTypes = {
  row: PropTypes.object.isRequired,
  selectionModeActive: PropTypes.bool.isRequired
}

export const FilePickerTableCell = ({ column, row, selectionModeActive }) => {
  if (!column || !row) return null

  if (column.id === 'name') {
    return (
      <FilePickerNameCell row={row} selectionModeActive={selectionModeActive} />
    )
  }
  if (column.id === 'updated_at') {
    return <UpdatedAtCell row={row} cell={row.updated_at || row.created_at} />
  }
  if (column.id === 'size') {
    return <SizeCell row={row} cell={row.size} />
  }

  return null
}

FilePickerTableCell.propTypes = {
  column: PropTypes.shape({
    id: PropTypes.string.isRequired
  }),
  row: PropTypes.object,
  selectionModeActive: PropTypes.bool
}
