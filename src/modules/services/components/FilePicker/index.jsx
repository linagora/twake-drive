import PropTypes from 'prop-types'
import React, { useState, memo } from 'react'

import { useQuery } from 'cozy-client'
import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import withBreakpoints from 'cozy-ui/transpiled/react/helpers/withBreakpoints'

import FilePickerBody from './FilePickerBody'
import FilePickerFooter from './FilePickerFooter'
import FilePickerHeader from './FilePickerHeader'
import { defaultFilePickerConfig } from './constants'
import { getActionDisabledState } from './constraints'
import { getCompliantTypes } from './helpers'
import { buildCurrentFolderQuery } from './queries'

export const ROOT_DIR_ID = 'io.cozy.files.root-dir'

const FilePicker = ({
  onClose,
  onChange,
  accept,
  multiple,
  filePickerConfig,
  breakpoints
}) => {
  const [folderId, setFolderId] = useState(ROOT_DIR_ID)
  const [itemsIdsSelected, setItemsIdsSelected] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [error, setError] = useState(null)

  const config = filePickerConfig || defaultFilePickerConfig
  const publicLinkAction = config.sharingLink ?? null
  const downloadLinkAction = config.downloadLink ?? null
  const referenceAction = config.reference ?? null

  const currentFolderQuery = buildCurrentFolderQuery(folderId)
  const { data: currentFolder } = useQuery(
    currentFolderQuery.definition,
    currentFolderQuery.options
  )
  const displayedFolder = Array.isArray(currentFolder)
    ? currentFolder[0]
    : currentFolder

  const onSelectItemId = (fileIds, item = null) => {
    setError(null)
    if (multiple) {
      setItemsIdsSelected(fileIds)
      if (item) {
        setSelectedItems(prev => [...prev, item])
      } else {
        setSelectedItems(prev => prev.filter(it => fileIds.includes(it._id)))
      }
    } else {
      setItemsIdsSelected(fileIds)
      setSelectedItems(item ? [item] : [])
    }
  }

  const navigateTo = folder => {
    setError(null)
    setFolderId(folder.id)
    setItemsIdsSelected([])
    setSelectedItems([])
  }

  const handleBack = () => {
    if (folderId !== ROOT_DIR_ID) {
      navigateTo({ id: displayedFolder?.dir_id ?? ROOT_DIR_ID })
    } else {
      onClose()
    }
  }

  const handleConfirm = async linkMode => {
    setError(null)
    const value = multiple ? itemsIdsSelected : itemsIdsSelected[0]
    const pickError = await onChange(value, linkMode)
    if (pickError) {
      setError(pickError)
    }
  }

  const itemTypesAccepted = getCompliantTypes(accept)
  const hasSelection = itemsIdsSelected.length > 0

  const publicLinkState = hasSelection
    ? getActionDisabledState(publicLinkAction, selectedItems)
    : { disabled: true, reasonKey: null }
  const downloadLinkState = hasSelection
    ? getActionDisabledState(downloadLinkAction, selectedItems)
    : { disabled: true, reasonKey: null }
  const referenceState = hasSelection
    ? getActionDisabledState(referenceAction, selectedItems)
    : { disabled: true, reasonKey: null }

  // On desktop, the dialog is not fullScreen: cozy-ui's FixedDialog renders
  // a separate close cross AND a separate back button when both onClose and
  // onBack are provided. We only want the "up one level or close" behavior
  // to collapse into cozy-ui's single fullScreen back/close button on
  // mobile, so onBack must stay undefined on desktop.
  const onBack = breakpoints.isMobile ? handleBack : undefined

  return (
    <FixedDialog
      open
      disableGutters
      onClose={onClose}
      onBack={onBack}
      size="large"
      title={<FilePickerHeader navigateTo={navigateTo} folderId={folderId} />}
      content={
        <FilePickerBody
          navigateTo={navigateTo}
          onSelectItemId={onSelectItemId}
          itemsIdsSelected={itemsIdsSelected}
          folderId={folderId}
          itemTypesAccepted={itemTypesAccepted}
          multiple={multiple}
          folderSelectable
          error={error}
        />
      }
      actions={
        <FilePickerFooter
          onConfirm={handleConfirm}
          publicLinkState={publicLinkState}
          downloadLinkState={downloadLinkState}
          referenceState={referenceState}
          publicLinkAction={publicLinkAction}
          downloadLinkAction={downloadLinkAction}
          referenceAction={referenceAction}
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
    downloadLink: PropTypes.object,
    reference: PropTypes.object
  }),
  breakpoints: PropTypes.shape({
    isMobile: PropTypes.bool.isRequired
  }).isRequired
}

FilePicker.defaultProps = {
  accept: '',
  multiple: false,
  filePickerConfig: defaultFilePickerConfig
}

export default memo(withBreakpoints()(FilePicker))
