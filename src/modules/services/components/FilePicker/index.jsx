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

import Divider from 'cozy-ui/transpiled/react/Divider'
import Paper from 'cozy-ui/transpiled/react/Paper'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

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

import { FilePicker as SharedFilePicker } from '@/components/FilePicker/FilePicker'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections
} from '@/components/FilePicker/constants'
import { getCompliantTypes, isValidFile } from '@/components/FilePicker/helpers'

const LinkAccessModal = lazy(() =>
  import('./LinkAccessModal').then(m => ({ default: m.LinkAccessModal }))
)

const FilePicker = ({
  onChange,
  onClose,
  accept,
  multiple,
  filePickerConfig,
  onReadyToUse,
  onFileDoubleClick
}) => {
  const [error, setError] = useState(null)
  const [isLinkAccessOpen, setIsLinkAccessOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState([])
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

  const clearSelection = () => setSelectedItems([])
  const handleLocationChange = useCallback(() => setError(null), [])

  const handleConfirm = async linkMode => {
    if (busyLinkMode) return null

    setBusyLinkMode(linkMode)
    setError(null)

    const value = multiple ? selectedItems : selectedItems[0]

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
    if (busyLinkMode) return

    setBusyLinkMode(filePickerLinkModes.PUBLIC_LINK)
    try {
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
    } finally {
      setBusyLinkMode(null)
    }
  }

  const handleFooterConfirm = linkMode => {
    if (busyLinkMode) return

    if (linkMode === filePickerLinkModes.PUBLIC_LINK) {
      handleOpenLinkAccess()
      return
    }

    handleConfirm(linkMode)
  }

  const itemTypesAccepted = getCompliantTypes(accept)
  const selectableTypes =
    itemTypesAccepted.length === 0
      ? Object.values(filePickerItemTypes)
      : [filePickerItemTypes.FOLDER, ...itemTypesAccepted]
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
      setSelectedItems([item])

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
        <SharedFilePicker
          mode={filePickerModes.SELECTION}
          availableSections={Object.values(filePickerSections)}
          displayedTypes={Object.values(filePickerItemTypes)}
          selectableTypes={selectableTypes}
          multiple={multiple}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          onLocationChange={handleLocationChange}
          error={error}
          onReadyToUse={onReadyToUse}
          onFileDoubleClick={handleFileDoubleClick}
          renderHeader={({
            activeSection,
            availableSections,
            onSectionChange
          }) => (
            <>
              <header
                className="u-pt-1-half u-pb-0 u-pl-1-half u-pr-2"
                data-testid="file-picker-header-wrapper"
              >
                <FilePickerHeader
                  activeSection={activeSection}
                  availableSections={availableSections}
                  onSectionChange={onSectionChange}
                  onClose={onClose}
                />
              </header>
              <Divider />
            </>
          )}
        />
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
            selectedItems={selectedItems}
            onClearSelection={clearSelection}
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
  onClose: PropTypes.func.isRequired,
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
