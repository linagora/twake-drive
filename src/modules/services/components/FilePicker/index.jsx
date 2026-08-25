import PropTypes from 'prop-types'
import React, {
  useState,
  memo,
  useMemo,
  useRef,
  useCallback,
  lazy,
  Suspense
} from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import Divider from 'cozy-ui/transpiled/react/Divider'
import Paper from 'cozy-ui/transpiled/react/Paper'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import FilePickerBody from './FilePickerBody'
import FilePickerFooter from './FilePickerFooter'
import FilePickerHeader from './FilePickerHeader'
import {
  defaultFilePickerConfig,
  filePickerDoubleClickResults,
  filePickerErrorCodes,
  filePickerLinkModes,
  filePickerThemes
} from './constants'
import { getActionDisabledState } from './constraints'
import { getCompliantTypes, isValidFile } from './helpers'

import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const LinkAccessModal = lazy(() =>
  import('./LinkAccessModal').then(m => ({ default: m.LinkAccessModal }))
)

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
  const [busyLinkMode, setBusyLinkMode] = useState(null)
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
    if (busyLinkMode) return null

    setBusyLinkMode(linkMode)
    setError(null)

    const value = multiple ? itemsIdsSelected : itemsIdsSelected[0]

    try {
      const pickError = await onChange(value, linkMode)
      if (pickError) {
        setError(pickError)
        return pickError
      }

      clearSelection()
      return null
    } finally {
      setBusyLinkMode(null)
    }
  }

  const handleOpenLinkAccess = useCallback(() => {
    setError(null)
    setIsLinkAccessOpen(true)
  }, [])

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

      const linkMode = useDownload
        ? filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
        : filePickerLinkModes.PUBLIC_LINK

      isProcessingRef.current = true
      setError(null)
      setSelectedItems({ [item._id]: item })

      try {
        const result = await onFileDoubleClick(item, linkMode)
        if (result === filePickerDoubleClickResults.OPEN_MODAL) {
          handleOpenLinkAccess()
        } else if (result) {
          setError(result)
        }
      } catch {
        setError(
          useDownload
            ? filePickerErrorCodes.DOWNLOAD_LINK_FAILED
            : filePickerErrorCodes.SHARING_LINK_FAILED
        )
      } finally {
        isProcessingRef.current = false
      }
    },
    [
      publicLinkAction,
      downloadLinkAction,
      itemTypesAccepted,
      onFileDoubleClick,
      setSelectedItems,
      handleOpenLinkAccess
    ]
  )

  return (
    <>
      <Paper
        className="u-h-100 u-w-100 u-flex u-flex-column"
        square
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
        <footer
          className="u-m-1 u-flex-shrink-0-s"
          data-testid="file-picker-footer"
        >
          <FilePickerFooter
            onConfirm={handleFooterConfirm}
            publicLinkState={publicLinkState}
            downloadLinkState={downloadLinkState}
            publicLinkAction={publicLinkAction}
            downloadLinkAction={downloadLinkAction}
            busyLinkMode={busyLinkMode}
          />
        </footer>
      </Paper>

      {isLinkAccessOpen && (
        <Suspense fallback={null}>
          <LinkAccessModal
            selectedItems={selectedItems}
            onCancel={() => setIsLinkAccessOpen(false)}
            onConfirm={handleLinkAccessConfirm}
          />
        </Suspense>
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
