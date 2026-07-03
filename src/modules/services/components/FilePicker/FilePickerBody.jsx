import PropTypes from 'prop-types'
import React, { useCallback } from 'react'

import { models, useQuery } from 'cozy-client'
import Alert from 'cozy-ui/transpiled/react/Alert'
import List from 'cozy-ui/transpiled/react/List'
import LoadMore from 'cozy-ui/transpiled/react/LoadMore'
import { useI18n } from 'twake-i18n'

import FilePickerBodyItem from './FilePickerBodyItem'
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

  // When click on checkbox/radio area...
  const handleChoiceClick = useCallback(
    item => () => {
      const canSelect =
        (folderSelectable && isDirectory(item)) ||
        isValidFile(item, itemTypesAccepted)

      if (!canSelect) return

      if (multiple) onCheck(item._id, item)
      else onSelectItemId([item._id], item)
    },
    [folderSelectable, itemTypesAccepted, multiple, onCheck, onSelectItemId]
  )

  // ...when click anywhere on the rest of the line
  const handleListItemClick = useCallback(
    item => () => {
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
    item => () => {
      if (isDirectory(item)) {
        navigateTo(item)
      }
    },
    [navigateTo]
  )

  return (
    <>
      {error && (
        <Alert
          severity="error"
          data-testid="file-picker-error"
          className="u-mt-1 u-mh-1"
        >
          {t(`FilePicker.errors.${error}`)}
        </Alert>
      )}
      <List>
        {contentFolder &&
          contentFolder.map((item, idx) => {
            const hasDivider = idx !== contentFolder.length - 1

            return (
              <FilePickerBodyItem
                key={item._id}
                item={item}
                itemTypesAccepted={itemTypesAccepted}
                multiple={multiple}
                folderSelectable={folderSelectable}
                handleChoiceClick={handleChoiceClick}
                handleListItemClick={handleListItemClick}
                handleListItemDoubleClick={handleListItemDoubleClick}
                itemsIdsSelected={itemsIdsSelected}
                hasDivider={hasDivider}
              />
            )
          })}
        {hasMore && <LoadMore label="loadMore" fetchMore={fetchMore} />}
      </List>
    </>
  )
}

FilePickerBody.propTypes = {
  onSelectItemId: PropTypes.func.isRequired,
  itemsIdsSelected: PropTypes.arrayOf(PropTypes.string).isRequired,
  folderId: PropTypes.string.isRequired,
  navigateTo: PropTypes.func.isRequired,
  itemTypesAccepted: PropTypes.arrayOf(PropTypes.string).isRequired,
  folderSelectable: PropTypes.bool,
  error: PropTypes.string
}

FilePickerBody.defaultProps = {
  folderSelectable: false
}

export default FilePickerBody
