import PropTypes from 'prop-types'
import React, { useCallback } from 'react'

import { models, useQuery } from 'cozy-client'
import List from 'cozy-ui/transpiled/react/List'
import LoadMore from 'cozy-ui/transpiled/react/LoadMore'

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
  multiple
}) => {
  const contentFolderQuery = buildContentFolderQuery(folderId)
  const {
    data: contentFolder,
    hasMore,
    fetchMore
  } = useQuery(contentFolderQuery.definition, contentFolderQuery.options)

  const onCheck = useCallback(
    itemId => {
      const isChecked = itemsIdsSelected.some(
        fileIdSelected => fileIdSelected === itemId
      )
      if (isChecked) {
        onSelectItemId(
          itemsIdsSelected.filter(fileIdSelected => fileIdSelected !== itemId)
        )
      } else onSelectItemId(prev => [...prev, itemId])
    },
    [itemsIdsSelected, onSelectItemId]
  )

  // When click on checkbox/radio area...
  const handleChoiceClick = useCallback(
    item => () => {
      if (multiple) onCheck(item._id)
      else onSelectItemId(item._id)
    },
    [multiple, onCheck, onSelectItemId]
  )

  // ...when click anywhere on the rest of the line
  const handleListItemClick = useCallback(
    item => () => {
      if (isDirectory(item)) {
        navigateTo(contentFolder.find(it => it._id === item._id))
      }

      if (isValidFile(item, itemTypesAccepted)) {
        if (multiple) onCheck(item._id)
        else onSelectItemId(item._id)
      }
    },
    [
      contentFolder,
      itemTypesAccepted,
      multiple,
      navigateTo,
      onCheck,
      onSelectItemId
    ]
  )

  return (
    <List>
      {contentFolder &&
        contentFolder.map((item, idx) => {
          const hasDivider = contentFolder
            ? idx !== contentFolder.length - 1
            : false

          return (
            <FilePickerBodyItem
              key={item._id}
              item={item}
              itemTypesAccepted={itemTypesAccepted}
              multiple={multiple}
              handleChoiceClick={handleChoiceClick}
              handleListItemClick={handleListItemClick}
              onCheck={onCheck}
              itemsIdsSelected={itemsIdsSelected}
              hasDivider={hasDivider}
            />
          )
        })}
      {hasMore && <LoadMore label="loadMore" fetchMore={fetchMore} />}
    </List>
  )
}

FilePickerBody.propTypes = {
  onSelectItemId: PropTypes.func.isRequired,
  itemsIdsSelected: PropTypes.arrayOf(PropTypes.string).isRequired,
  folderId: PropTypes.string.isRequired,
  navigateTo: PropTypes.func.isRequired,
  itemTypesAccepted: PropTypes.arrayOf(PropTypes.string).isRequired
}

export default FilePickerBody
