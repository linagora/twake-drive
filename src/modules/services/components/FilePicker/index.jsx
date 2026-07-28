import PropTypes from 'prop-types'
import React, { useState, memo, useMemo, useRef, useCallback } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import Divider from 'cozy-ui/transpiled/react/Divider'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import FilePickerBody from './FilePickerBody'
import FilePickerFooter from './FilePickerFooter'
import FilePickerHeader from './FilePickerHeader'
import { LinkAccessModal } from './LinkAccessModal'
import {
  defaultFilePickerConfig,
  filePickerLinkModes,
  filePickerThemes
} from './constants'
import { getActionDisabledState } from './constraints'
import { getCompliantTypes, isValidFile } from './helpers'

import { useSelectionContext } from '@/modules/selection/SelectionProvider'

export const ROOT_DIR_ID = 'io.cozy.files.root-dir'

const FilePicker = ({
  onChange,
  accept,
  multiple,
  filePickerConfig,
  onReadyToUse,
  onFileDoubleClick
}) => {
  const [folderId, setFolderId] = useState(ROOT_DIR_ID)
  const [error, setError] = useState(null)
  const [isLinkAccessOpen, setIsLinkAccessOpen] = useState(false)
  const { selectedItems, clearSelection, setSelectedItems } =
    useSelectionContext()
  const { showAlert } = useAlert()
  const isProcessingRef = useRef(false)
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

  const handleFileDoubleClick = useCallback(
    async item => {
      if (!onFileDoubleClick) return
      if (isProcessingRef.current) return

      if (!isValidFile(item, itemTypesAccepted)) return

      // Sharing takes priority over download
      const sharingState = publicLinkAction
        ? getActionDisabledState(publicLinkAction, [item])
        : { disabled: true }
      const downloadState = downloadLinkAction
        ? getActionDisabledState(downloadLinkAction, [item])
        : { disabled: true }
      const useDownload = sharingState.disabled && !downloadState.disabled
      if (sharingState.disabled && downloadState.disabled) return

      isProcessingRef.current = true
      setSelectedItems({ [item._id]: item })

      try {
        if (useDownload) {
          const pickError = await onChange(
            [item],
            filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
          )
          if (pickError) {
            setError(pickError)
          }
          return
        }

        const result = await onFileDoubleClick(item)
        if (result === 'open-modal') {
          setIsLinkAccessOpen(true)
        } else if (result) {
          setError(result)
        }
      } finally {
        isProcessingRef.current = false
      }
    },
    [
      publicLinkAction,
      downloadLinkAction,
      itemTypesAccepted,
      onFileDoubleClick,
      onChange,
      setSelectedItems
    ]
  )

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
            onFileDoubleClick={handleFileDoubleClick}
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
    theme: PropTypes.shape({
      type: PropTypes.oneOf(filePickerThemes)
    }),
    multiple: PropTypes.bool,
    sharingLink: PropTypes.object,
    downloadLink: PropTypes.object
  }),
  onReadyToUse: PropTypes.func,
  onFileDoubleClick: PropTypes.func
}

FilePicker.defaultProps = {
  accept: '',
  multiple: false,
  filePickerConfig: defaultFilePickerConfig
}

export default memo(FilePicker)
