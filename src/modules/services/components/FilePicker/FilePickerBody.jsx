import PropTypes from 'prop-types'
import React, { useCallback } from 'react'

import { models, useQuery } from 'cozy-client'
import Alert from 'cozy-ui/transpiled/react/Alert'
import Box from 'cozy-ui/transpiled/react/Box'
import { useI18n } from 'twake-i18n'

import { FilePickerTable } from './FilePickerTable'
import { isValidFile } from './helpers'
import { buildContentFolderQuery } from './queries'

const {
  file: { isDirectory }
} = models

const FilePickerBody = ({
  navigateTo,
  folderId,
  onSelectItemId,
  itemsIdsSelected,
  itemTypesAccepted,
  multiple,
  folderSelectable,
  error
}) => {
  const { t } = useI18n()
  const contentFolderQuery = buildContentFolderQuery(folderId)
  const {
    data: contentFolder,
    hasMore,
    fetchMore
  } = useQuery(contentFolderQuery.definition, contentFolderQuery.options)

  const onCheck = useCallback(
    (itemId, item) => {
      const isChecked = itemsIdsSelected.some(id => id === itemId)
      if (isChecked) {
        onSelectItemId(
          itemsIdsSelected.filter(id => id !== itemId),
          null
        )
      } else {
        onSelectItemId([...itemsIdsSelected, itemId], item)
      }
    },
    [itemsIdsSelected, onSelectItemId]
  )

  const handleListItemClick = useCallback(
    item => {
      const canSelect =
        (folderSelectable && isDirectory(item)) ||
        isValidFile(item, itemTypesAccepted)

      if (!canSelect) return

      if (multiple) onCheck(item._id, item)
      else onSelectItemId([item._id], item)
    },
    [folderSelectable, itemTypesAccepted, multiple, onCheck, onSelectItemId]
  )

  const handleListItemDoubleClick = useCallback(
    item => {
      if (isDirectory(item)) {
        navigateTo(item)
      }
    },
    [navigateTo]
  )

  return (
    <Box
      className="u-pos-absolute u-top-0 u-right-0 u-bottom-0 u-left-0"
      display="flex"
      flexDirection="column"
    >
      {error && (
        <Alert
          severity="error"
          data-testid="file-picker-error"
          className="u-mt-1 u-mh-1"
        >
          {t(`FilePicker.errors.${error}`)}
        </Alert>
      )}
      <FilePickerTable
        items={contentFolder || []}
        itemsIdsSelected={itemsIdsSelected}
        onItemClick={handleListItemClick}
        onItemDoubleClick={handleListItemDoubleClick}
        fetchMore={hasMore ? fetchMore : undefined}
      />
    </Box>
  )
}

FilePickerBody.propTypes = {
  onSelectItemId: PropTypes.func.isRequired,
  itemsIdsSelected: PropTypes.arrayOf(PropTypes.string).isRequired,
  folderId: PropTypes.string.isRequired,
  navigateTo: PropTypes.func.isRequired,
  itemTypesAccepted: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  folderSelectable: PropTypes.bool,
  error: PropTypes.string
}

FilePickerBody.defaultProps = {
  multiple: false,
  folderSelectable: false,
  error: null
}

export default FilePickerBody
