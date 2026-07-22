import PropTypes from 'prop-types'
import React, { useState, memo, useMemo } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import Divider from 'cozy-ui/transpiled/react/Divider'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import FilePickerBody from './FilePickerBody'
import FilePickerFooter from './FilePickerFooter'
import FilePickerHeader from './FilePickerHeader'
import { LinkAccessModal } from './LinkAccessModal'
import { defaultFilePickerConfig, filePickerLinkModes } from './constants'
import { getActionDisabledState } from './constraints'
import { getCompliantTypes } from './helpers'

import { useSelectionContext } from '@/modules/selection/SelectionProvider'

export const ROOT_DIR_ID = 'io.cozy.files.root-dir'

const FilePicker = ({
  onChange,
  accept,
  multiple,
  filePickerConfig,
  onReadyToUse
}) => {
  const [folderId, setFolderId] = useState(ROOT_DIR_ID)
  const [error, setError] = useState(null)
  const [isLinkAccessOpen, setIsLinkAccessOpen] = useState(false)
  const { selectedItems, clearSelection } = useSelectionContext()
  const { showAlert } = useAlert()
  const itemsIdsSelected = useMemo(
    () => selectedItems.map(item => item._id),
    [selectedItems]
  )

  const config = filePickerConfig || defaultFilePickerConfig
  const publicLinkAction = config.sharingLink ?? null
  const downloadLinkAction = config.downloadLink ?? null

  const navigateTo = folder => {
    setError(null)
    setFolderId(folder.id ?? folder._id)
    clearSelection()
  }

  const handleConfirm = async linkMode => {
    setError(null)
    const value = multiple ? itemsIdsSelected : itemsIdsSelected[0]
    const pickError = await onChange(value, linkMode)
    if (pickError) {
      setError(pickError)
      return pickError
    }

    clearSelection()
    return null
  }

  const handleOpenLinkAccess = () => {
    setError(null)
    setIsLinkAccessOpen(true)
  }

  const handleLinkAccessConfirm = async sharingLinks => {
    const pickError = await onChange(
      selectedItems,
      filePickerLinkModes.PUBLIC_LINK,
      sharingLinks
    )
    if (pickError) {
      showAlert({ message: pickError, severity: 'error' })
      return
    }

    clearSelection()
    setIsLinkAccessOpen(false)
  }

  const handleFooterConfirm = linkMode => {
    if (linkMode === filePickerLinkModes.PUBLIC_LINK) {
      handleOpenLinkAccess()
      return
    }

    handleConfirm(linkMode)
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
    <>
      <div
        className="u-h-100 u-w-100 u-flex u-flex-column"
        data-testid="file-picker"
      >
        <header
          className="u-pv-1-half u-pl-1-half u-pr-2"
          data-testid="file-picker-header-wrapper"
        >
          <FilePickerHeader />
        </header>
        <Divider />
        <Box
          flex={1}
          minHeight={0}
          className="u-pos-relative"
          data-testid="file-picker-body-wrapper"
        >
          <FilePickerBody
            navigateTo={navigateTo}
            folderId={folderId}
            itemTypesAccepted={itemTypesAccepted}
            multiple={multiple}
            folderSelectable
            error={error}
            onReadyToUse={onReadyToUse}
          />
        </Box>
        <Divider />
        <footer className="u-mv-1 u-mh-2" data-testid="file-picker-footer">
          <FilePickerFooter
            onConfirm={handleFooterConfirm}
            publicLinkState={publicLinkState}
            downloadLinkState={downloadLinkState}
            publicLinkAction={publicLinkAction}
            downloadLinkAction={downloadLinkAction}
          />
        </footer>
      </div>

      {isLinkAccessOpen && (
        <LinkAccessModal
          selectedItems={selectedItems}
          onCancel={() => setIsLinkAccessOpen(false)}
          onConfirm={handleLinkAccessConfirm}
        />
      )}
    </>
  )
}

FilePicker.propTypes = {
  onChange: PropTypes.func.isRequired,
  accept: PropTypes.string,
  multiple: PropTypes.bool,
  filePickerConfig: PropTypes.shape({
    sharingLink: PropTypes.object,
    downloadLink: PropTypes.object
  }),
  onReadyToUse: PropTypes.func
}

FilePicker.defaultProps = {
  accept: '',
  multiple: false,
  filePickerConfig: defaultFilePickerConfig
}

export default memo(FilePicker)
