import PropTypes from 'prop-types'
import React, { useState, memo } from 'react'

import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'

import FilePickerBody from './FilePickerBody'
import FilePickerFooter from './FilePickerFooter'
import FilePickerHeader from './FilePickerHeader'
import { defaultFilePickerConfig } from './constants'
import { getActionDisabledState } from './constraints'
import { getCompliantTypes } from './helpers'

export const ROOT_DIR_ID = 'io.cozy.files.root-dir'

const FilePicker = ({
  onClose,
  onChange,
  accept,
  multiple,
  filePickerConfig
}) => {
  const [folderId, setFolderId] = useState(ROOT_DIR_ID)
  const [itemsIdsSelected, setItemsIdsSelected] = useState([])
  const [selectedItems, setSelectedItems] = useState([])

  const config = filePickerConfig || defaultFilePickerConfig
  const publicLinkAction = config.sharingLink ?? null
  const downloadLinkAction = config.downloadLink ?? null
  const onSelectItemId = (fileId, item = null) => {
    if (multiple) {
      setItemsIdsSelected(fileId)
      if (item) {
        setSelectedItems(prev => [...prev, item])
      } else {
        setSelectedItems(prev => prev.filter(it => fileId.includes(it._id)))
      }
    } else {
      setItemsIdsSelected([fileId])
      setSelectedItems(item ? [item] : [])
    }
  }

  const navigateTo = folder => {
    setFolderId(folder.id)
    setItemsIdsSelected([])
    setSelectedItems([])
  }

  const handleConfirm = linkMode => {
    const value = multiple ? itemsIdsSelected : itemsIdsSelected[0]
    onChange(value, linkMode)
  }

  const itemTypesAccepted = getCompliantTypes(accept)
  const hasSelection = itemsIdsSelected.length > 0

  const publicLinkState = hasSelection
    ? getActionDisabledState(publicLinkAction, selectedItems)
    : { disabled: true, reasonKey: null }
  const downloadLinkState = hasSelection
    ? getActionDisabledState(downloadLinkAction, selectedItems)
    : { disabled: true, reasonKey: null }

  return (
    <FixedDialog
      open
      disableGutters
      onClose={onClose}
      size="large"
      title={
        <FilePickerHeader
          navigateTo={navigateTo}
          folderId={folderId}
          onClose={onClose}
        />
      }
      content={
        <FilePickerBody
          navigateTo={navigateTo}
          onSelectItemId={onSelectItemId}
          itemsIdsSelected={itemsIdsSelected}
          folderId={folderId}
          itemTypesAccepted={itemTypesAccepted}
          multiple={multiple}
          folderSelectable
        />
      }
      actions={
        <FilePickerFooter
          onConfirm={handleConfirm}
          publicLinkState={publicLinkState}
          downloadLinkState={downloadLinkState}
          publicLinkAction={publicLinkAction}
          downloadLinkAction={downloadLinkAction}
        />
      }
    />
  )
}

FilePicker.propTypes = {
  onClose: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  accept: PropTypes.string,
  multiple: PropTypes.bool,
  filePickerConfig: PropTypes.shape({
    sharingLink: PropTypes.object,
    downloadLink: PropTypes.object
  })
}

FilePicker.defaultProps = {
  accept: '',
  multiple: false,
  filePickerConfig: defaultFilePickerConfig
}

export default memo(FilePicker)
