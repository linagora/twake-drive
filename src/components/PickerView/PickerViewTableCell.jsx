import { Icon, Right } from '@linagora/twake-icons'
import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React from 'react'

import { isDirectory } from 'cozy-client/dist/models/file'
import Checkbox from 'cozy-ui/transpiled/react/Checkbox'
import Filename from 'cozy-ui/transpiled/react/Filename'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import {
  getFileNameAndExtension,
  makeFileMetadata,
  makeParentFolderPath
} from '@/modules/filelist/helpers'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'
import { useFormattedUpdatedAt } from '@/modules/filelist/useFormattedUpdatedAt'
import SizeCell from '@/modules/filelist/virtualized/cells/columns/SizeCell'
import UpdatedAtCell from '@/modules/filelist/virtualized/cells/columns/UpdatedAtCell'

export const PickerViewNameCell = ({
  row,
  selectionModeActive,
  isSelectedItem,
  onItemNavigate,
  isItemDisabled = () => false,
  getItemDisabledReason,
  withFilePath
}) => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const isSelected = isSelectedItem ? isSelectedItem(row) : false
  const { title, filename, extension } = getFileNameAndExtension(row, t)
  const isFolder = isDirectory(row)
  const formattedUpdatedAt = useFormattedUpdatedAt(
    row.updated_at || row.created_at
  )
  const formattedSize =
    !isFolder && row.size !== null && row.size !== undefined
      ? filesize(row.size, { base: 10 })
      : null
  const metadata = withFilePath
    ? makeParentFolderPath(row) || null
    : isMobile && !isFolder
      ? makeFileMetadata(formattedUpdatedAt ?? '—', formattedSize ?? '—')
      : null
  const disabledReason = getItemDisabledReason?.(row)
  const handleNavigate = event => {
    event.stopPropagation()
    onItemNavigate(row)
  }

  const filenameContent = (
    <Filename
      filename={filename}
      extension={extension}
      midEllipsis
      path={metadata}
    />
  )
  const filenameWithTooltip = disabledReason ? (
    <Tooltip title={t(disabledReason)} placement="top">
      <span
        className="u-inline-flex u-flex-items-center"
        data-testid="picker-item-name"
      >
        {filenameContent}
      </span>
    </Tooltip>
  ) : (
    filenameContent
  )

  return (
    <div
      data-testid="listitem-onclick"
      className="u-flex u-flex-items-center"
      title={disabledReason ? undefined : title}
    >
      {isMobile && selectionModeActive && (
        <Checkbox checked={isSelected} size="medium" onChange={() => {}} />
      )}
      <div
        data-testid="choice-onclick"
        className="u-flex u-flex-items-center u-flex-shrink-0 u-mr-1"
      >
        <FileThumbnail file={row} />
      </div>
      <div className="u-flex-grow-1 u-ellipsis">{filenameWithTooltip}</div>
      {onItemNavigate && isFolder && (
        <IconButton
          aria-label={t('Move.openFolder')}
          className="u-ml-auto"
          disabled={isItemDisabled(row)}
          onClick={handleNavigate}
          size="small"
        >
          <Icon icon={Right} />
        </IconButton>
      )}
    </div>
  )
}

PickerViewNameCell.displayName = 'PickerViewNameCell'
PickerViewNameCell.propTypes = {
  row: PropTypes.object.isRequired,
  selectionModeActive: PropTypes.bool.isRequired,
  isSelectedItem: PropTypes.func,
  onItemNavigate: PropTypes.func,
  isItemDisabled: PropTypes.func,
  getItemDisabledReason: PropTypes.func,
  withFilePath: PropTypes.bool
}

export const PickerViewTableCell = ({
  column,
  row,
  selectionModeActive,
  isSelectedItem,
  onItemNavigate,
  isItemDisabled,
  getItemDisabledReason,
  withFilePath
}) => {
  if (!column || !row) return null

  if (column.id === 'name') {
    return (
      <PickerViewNameCell
        row={row}
        selectionModeActive={selectionModeActive}
        isSelectedItem={isSelectedItem}
        onItemNavigate={onItemNavigate}
        isItemDisabled={isItemDisabled}
        getItemDisabledReason={getItemDisabledReason}
        withFilePath={withFilePath}
      />
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

PickerViewTableCell.displayName = 'PickerViewTableCell'
PickerViewTableCell.propTypes = {
  column: PropTypes.shape({
    id: PropTypes.string.isRequired
  }),
  row: PropTypes.object,
  selectionModeActive: PropTypes.bool,
  isSelectedItem: PropTypes.func,
  onItemNavigate: PropTypes.func,
  isItemDisabled: PropTypes.func,
  getItemDisabledReason: PropTypes.func,
  withFilePath: PropTypes.bool
}

export default PickerViewTableCell
