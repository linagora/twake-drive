import { fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'

import { filePickerDoubleClickResults, filePickerLinkModes } from './constants'
import FilePicker from './index'

import {
  filePickerSections,
  FILE_PICKER_SHARINGS_ROOT_ID
} from '@/components/FilePicker/constants'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'

jest.mock('cozy-client', () => ({
  models: {
    file: {
      isDirectory: item => item?.type === 'directory',
      isFile: item => item?.type === 'file'
    }
  }
}))

const mockShowAlert = jest.fn()

jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  useAlert: () => ({ showAlert: mockShowAlert })
}))

jest.mock('./FilePickerHeader', () => ({ activeSection, onSectionChange }) => (
  <div data-testid="file-picker-header-inner">
    <span data-testid="active-section">{activeSection}</span>
    <button
      type="button"
      data-testid="drive-section-btn"
      onClick={() => onSectionChange('drive')}
    >
      Drive
    </button>
    <button
      type="button"
      data-testid="sharings-section-btn"
      onClick={() => onSectionChange('sharings')}
    >
      Sharings
    </button>
  </div>
))

jest.mock('@/components/FilePicker/FilePicker', () => {
  const React = require('react')

  const file = {
    _id: 'file-id',
    type: 'file',
    name: 'file.pdf',
    size: 1024
  }

  const secondFile = {
    _id: 'second-file-id',
    type: 'file',
    name: 'second-file.pdf',
    size: 2048
  }

  const imageFile = {
    _id: 'image-file-id',
    type: 'file',
    name: 'image.png',
    size: 1024,
    mime: 'image/png'
  }

  const folder = {
    _id: 'folder-id',
    id: 'folder-id',
    type: 'directory',
    name: 'Folder'
  }

  return {
    FilePicker: ({
      selectableTypes,
      selectedItems,
      onSelectionChange,
      onLocationChange,
      onFileDoubleClick,
      error,
      renderHeader
    }) => {
      const [location, setLocation] = React.useState({
        section: 'drive',
        folderId: 'io.cozy.files.root-dir'
      })
      const handleSectionChange = section => {
        setLocation({
          section,
          folderId:
            section === 'drive'
              ? 'io.cozy.files.root-dir'
              : 'file-picker-sharings-root'
        })
        onSelectionChange([])
        onLocationChange()
      }
      const navigateTo = item => {
        setLocation(current => ({ ...current, folderId: item._id }))
        onSelectionChange([])
        onLocationChange()
      }

      return (
        <>
          {renderHeader({
            activeSection: location.section,
            onSectionChange: handleSectionChange
          })}
          <div>
            <span data-testid="body-section">{location.section}</span>
            <span data-testid="body-folder-id">{location.folderId}</span>
            <span data-testid="body-section-changing">false</span>
            <span data-testid="folder-selectable">
              {selectableTypes.includes('folder') ? 'true' : 'false'}
            </span>
            {error && <div data-testid="file-picker-error">{error}</div>}
            <button
              type="button"
              data-testid="select-file-btn"
              onClick={() => onSelectionChange([file])}
            >
              Select file
            </button>
            <button
              type="button"
              data-testid="select-second-file-btn"
              onClick={() => onSelectionChange([file, secondFile])}
            >
              Select second file
            </button>
            <button
              type="button"
              data-testid="select-image-file-btn"
              onClick={() => onSelectionChange([imageFile])}
            >
              Select image file
            </button>
            <button
              type="button"
              data-testid="select-folder-btn"
              onClick={() => onSelectionChange([folder])}
            >
              Select folder
            </button>
            <button
              type="button"
              data-testid="select-file-and-folder-btn"
              onClick={() => onSelectionChange([file, folder])}
            >
              Select file and folder
            </button>
            <button
              type="button"
              data-testid="navigate-folder-btn"
              onClick={() => navigateTo(folder)}
            >
              Navigate folder
            </button>
            {onFileDoubleClick && (
              <button
                type="button"
                data-testid="double-click-file-btn"
                onClick={() => onFileDoubleClick(file)}
              >
                Double-click file
              </button>
            )}
            <span data-testid="selected-count">{selectedItems.length}</span>
          </div>
        </>
      )
    }
  }
})

jest.mock(
  './FilePickerFooter',
  () =>
    ({
      onConfirm,
      publicLinkState,
      downloadLinkState,
      publicLinkAction,
      downloadLinkAction
    }) => (
      <div>
        {publicLinkAction && (
          <button
            type="button"
            data-testid="public-link-btn"
            disabled={publicLinkState?.disabled}
            onClick={() => onConfirm('public-link')}
          >
            {publicLinkAction.label || 'Public link'}
          </button>
        )}
        {downloadLinkAction && (
          <button
            type="button"
            data-testid="temporary-download-link-btn"
            disabled={downloadLinkState?.disabled}
            onClick={() => onConfirm('temporary-download-link')}
          >
            {downloadLinkAction.label || 'Temporary link'}
          </button>
        )}
      </div>
    )
)

jest.mock('./LinkAccessModal', () => ({
  LinkAccessModal: ({ selectedItems, onCancel, onConfirm }) => (
    <div data-testid="link-access-modal">
      <span>{selectedItems.map(item => item.name).join(', ')}</span>
      <button type="button" onClick={onCancel}>
        Cancel link access
      </button>
      <button
        type="button"
        data-testid="confirm-link-access-btn"
        onClick={() =>
          onConfirm(
            selectedItems.map(item => ({
              documentId: item._id,
              url: `https://${item._id}`
            }))
          )
        }
      >
        Confirm link access
      </button>
    </div>
  )
}))

const FilePickerWrapper = ({ children }) => (
  <SelectionProvider clearOnLocationChange={false}>
    {children}
  </SelectionProvider>
)

describe('FilePicker', () => {
  const mockOnChange = jest.fn()
  const mockOnFileDoubleClick = jest.fn()
  const mockOnClose = jest.fn()

  const setup = ({
    filePickerConfig,
    multiple = false,
    onFileDoubleClick,
    onClose,
    accept
  } = {}) => {
    return render(
      <FilePickerWrapper>
        <FilePicker
          onChange={mockOnChange}
          onFileDoubleClick={onFileDoubleClick ?? mockOnFileDoubleClick}
          onClose={onClose ?? mockOnClose}
          filePickerConfig={filePickerConfig}
          multiple={multiple}
          accept={accept}
        />
      </FilePickerWrapper>
    )
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render both action buttons by default', () => {
    const { getByTestId } = setup()

    expect(getByTestId('public-link-btn')).toBeInTheDocument()
    expect(getByTestId('temporary-download-link-btn')).toBeInTheDocument()
  })

  it('should enable folder selection for public link mode', () => {
    const { getByTestId } = setup()

    expect(getByTestId('folder-selectable')).toHaveTextContent('true')
  })

  it('should hide the download link button when the config disables the action', () => {
    const { queryByTestId, getByTestId } = setup({
      filePickerConfig: {
        sharingLink: { allowFolder: true },
        downloadLink: null
      }
    })

    expect(queryByTestId('temporary-download-link-btn')).toBeNull()
    expect(getByTestId('public-link-btn')).toBeInTheDocument()
  })

  it('should collect link access before confirming a public link', async () => {
    const { getByTestId, findByTestId } = setup()

    expect(getByTestId('public-link-btn')).toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()

    fireEvent.click(getByTestId('select-file-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).not.toBeDisabled()
    expect(mockOnChange).not.toHaveBeenCalled()

    fireEvent.click(getByTestId('public-link-btn'))

    expect(await findByTestId('link-access-modal')).toHaveTextContent(
      'file.pdf'
    )
    expect(mockOnChange).not.toHaveBeenCalled()

    fireEvent.click(getByTestId('confirm-link-access-btn'))

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith(
        [
          {
            _id: 'file-id',
            type: 'file',
            name: 'file.pdf',
            size: 1024
          }
        ],
        filePickerLinkModes.PUBLIC_LINK,
        [{ documentId: 'file-id', url: 'https://file-id' }]
      )
    )
  })

  it('should pass selected file objects when confirming an action', async () => {
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('temporary-download-link-btn'))

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith(
        {
          _id: 'file-id',
          type: 'file',
          name: 'file.pdf',
          size: 1024
        },
        filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
      )
    )
  })

  it('should pass all selected file objects in multiple mode', async () => {
    const { getByTestId } = setup({ multiple: true })

    fireEvent.click(getByTestId('select-second-file-btn'))
    fireEvent.click(getByTestId('temporary-download-link-btn'))

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith(
        [
          {
            _id: 'file-id',
            type: 'file',
            name: 'file.pdf',
            size: 1024
          },
          {
            _id: 'second-file-id',
            type: 'file',
            name: 'second-file.pdf',
            size: 2048
          }
        ],
        filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
      )
    )
  })

  it('should pass confirmation errors to the body and retain selection', async () => {
    mockOnChange.mockResolvedValueOnce('ITEM_NOT_FOUND')
    const { getByTestId, queryByTestId } = setup()

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('temporary-download-link-btn'))

    await waitFor(() =>
      expect(getByTestId('file-picker-error')).toHaveTextContent(
        'ITEM_NOT_FOUND'
      )
    )
    expect(getByTestId('temporary-download-link-btn')).not.toBeDisabled()
    expect(mockOnChange).toHaveBeenCalledWith(
      {
        _id: 'file-id',
        type: 'file',
        name: 'file.pdf',
        size: 1024
      },
      filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
    )

    fireEvent.click(getByTestId('navigate-folder-btn'))
    expect(queryByTestId('file-picker-error')).toBe(null)
  })

  it('should ignore a second public-link confirmation while the first is in-flight', async () => {
    let resolveFirst
    mockOnChange.mockReturnValue(
      new Promise(resolve => {
        resolveFirst = resolve
      })
    )
    const { getByTestId, findByTestId } = setup()

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('public-link-btn'))

    await findByTestId('link-access-modal')
    fireEvent.click(getByTestId('confirm-link-access-btn'))
    fireEvent.click(getByTestId('confirm-link-access-btn'))

    expect(mockOnChange).toHaveBeenCalledTimes(1)

    resolveFirst(null)
    await waitFor(() => expect(mockShowAlert).not.toHaveBeenCalled())
  })

  it('should keep link access open when link generation fails', async () => {
    mockOnChange.mockResolvedValueOnce('SHARING_LINK_FAILED')
    const { getByTestId, findByTestId } = setup()

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('public-link-btn'))

    await findByTestId('link-access-modal')
    fireEvent.click(getByTestId('confirm-link-access-btn'))

    await waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith({
        message: 'SHARING_LINK_FAILED',
        severity: 'error'
      })
    )
  })

  it('should disable temporary download link when a folder is selected', () => {
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('select-folder-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()
  })

  it('should preserve multiple selected file ids while collecting link access', async () => {
    const { getByTestId, findByTestId } = setup({ multiple: true })

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('select-second-file-btn'))
    fireEvent.click(getByTestId('public-link-btn'))

    await findByTestId('link-access-modal')
    fireEvent.click(getByTestId('confirm-link-access-btn'))

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith(
        [
          { _id: 'file-id', type: 'file', name: 'file.pdf', size: 1024 },
          {
            _id: 'second-file-id',
            type: 'file',
            name: 'second-file.pdf',
            size: 2048
          }
        ],
        filePickerLinkModes.PUBLIC_LINK,
        [
          { documentId: 'file-id', url: 'https://file-id' },
          {
            documentId: 'second-file-id',
            url: 'https://second-file-id'
          }
        ]
      )
    )
  })

  it('should apply action constraints to all selected items', () => {
    const { getByTestId } = setup({ multiple: true })

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('select-file-and-folder-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()
  })

  it.each([
    [
      'maximum file size',
      { sharingLink: { allowFolder: true, maxFileSize: 1536 } },
      'public-link-btn',
      'select-file-btn',
      'select-second-file-btn'
    ],
    [
      'allowed MIME types (image file)',
      { sharingLink: { allowFolder: true, allowedMimeTypes: ['image/*'] } },
      'public-link-btn',
      'select-image-file-btn',
      'select-file-btn'
    ],
    [
      'allowed MIME types (folder)',
      { sharingLink: { allowFolder: true, allowedMimeTypes: ['image/*'] } },
      'public-link-btn',
      'select-folder-btn',
      'select-file-btn'
    ],
    [
      'maximum file count',
      { downloadLink: { maxFileCount: 1 } },
      'temporary-download-link-btn',
      'select-file-btn',
      'select-second-file-btn'
    ],
    [
      'available size',
      { downloadLink: { availableSize: 2048 } },
      'temporary-download-link-btn',
      'select-file-btn',
      'select-second-file-btn'
    ]
  ])(
    'should disable an action when its %s constraint is exceeded',
    (
      _,
      filePickerConfig,
      actionTestId,
      validSelectionTestId,
      invalidSelectionTestId
    ) => {
      const { getByTestId } = setup({ filePickerConfig, multiple: true })

      fireEvent.click(getByTestId(validSelectionTestId))
      expect(getByTestId(actionTestId)).not.toBeDisabled()

      fireEvent.click(getByTestId(invalidSelectionTestId))
      expect(getByTestId(actionTestId)).toBeDisabled()
    }
  )

  it('should switch sections at their roots, clear selection, and complete section transition', async () => {
    const { getByTestId } = setup({ multiple: true })

    expect(getByTestId('active-section')).toHaveTextContent(
      filePickerSections.DRIVE
    )
    expect(getByTestId('body-section-changing')).toHaveTextContent('false')
    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('sharings-section-btn'))

    expect(getByTestId('body-section')).toHaveTextContent(
      filePickerSections.SHARINGS
    )
    expect(getByTestId('body-folder-id')).toHaveTextContent(
      FILE_PICKER_SHARINGS_ROOT_ID
    )
    expect(getByTestId('public-link-btn')).toBeDisabled()
    await waitFor(() =>
      expect(getByTestId('body-section-changing')).toHaveTextContent('false')
    )

    fireEvent.click(getByTestId('navigate-folder-btn'))
    fireEvent.click(getByTestId('drive-section-btn'))
    fireEvent.click(getByTestId('sharings-section-btn'))
    expect(getByTestId('body-folder-id')).toHaveTextContent(
      FILE_PICKER_SHARINGS_ROOT_ID
    )
  })

  it('should clear selection when navigating to another folder', () => {
    const { getByTestId } = setup({ multiple: true })

    fireEvent.click(getByTestId('select-file-btn'))
    expect(getByTestId('public-link-btn')).not.toBeDisabled()

    fireEvent.click(getByTestId('navigate-folder-btn'))

    expect(getByTestId('public-link-btn')).toBeDisabled()
  })

  describe('double-click action', () => {
    it('should reuse existing single-file sharing link without opening modal', async () => {
      const { getByTestId, queryByTestId } = setup({
        filePickerConfig: {
          sharingLink: { allowFolder: true },
          downloadLink: null
        }
      })

      fireEvent.click(getByTestId('double-click-file-btn'))

      await waitFor(() =>
        expect(mockOnFileDoubleClick).toHaveBeenCalledWith(
          {
            _id: 'file-id',
            type: 'file',
            name: 'file.pdf',
            size: 1024
          },
          filePickerLinkModes.PUBLIC_LINK
        )
      )
      expect(queryByTestId('link-access-modal')).toBeNull()
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should open LinkAccessModal when onFileDoubleClick returns open-modal', async () => {
      mockOnFileDoubleClick.mockResolvedValue(
        filePickerDoubleClickResults.OPEN_MODAL
      )
      const { getByTestId } = setup()

      fireEvent.click(getByTestId('double-click-file-btn'))

      await waitFor(() =>
        expect(getByTestId('link-access-modal')).toHaveTextContent('file.pdf')
      )
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should display error when onFileDoubleClick rejects', async () => {
      mockOnFileDoubleClick.mockRejectedValue(new Error('sharing failed'))
      const { getByTestId, queryByTestId } = setup()

      fireEvent.click(getByTestId('double-click-file-btn'))

      await waitFor(() =>
        expect(getByTestId('file-picker-error')).toBeInTheDocument()
      )
      expect(queryByTestId('link-access-modal')).toBeNull()
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should delegate download link generation when sharing is unavailable', async () => {
      mockOnFileDoubleClick.mockResolvedValue(null)
      const { getByTestId, queryByTestId } = setup({
        filePickerConfig: {
          sharingLink: null,
          downloadLink: { allowFolder: false }
        }
      })

      fireEvent.click(getByTestId('double-click-file-btn'))

      await waitFor(() =>
        expect(mockOnFileDoubleClick).toHaveBeenCalledWith(
          { _id: 'file-id', type: 'file', name: 'file.pdf', size: 1024 },
          filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
        )
      )
      expect(queryByTestId('link-access-modal')).toBeNull()
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should do nothing when neither action is configured', () => {
      const { getByTestId, queryByTestId } = setup({
        filePickerConfig: {
          sharingLink: null,
          downloadLink: null
        }
      })

      fireEvent.click(getByTestId('double-click-file-btn'))

      expect(mockOnFileDoubleClick).not.toHaveBeenCalled()
      expect(mockOnChange).not.toHaveBeenCalled()
      expect(queryByTestId('file-picker-error')).toBeNull()
    })

    it('should ignore file rejected by accept filter', () => {
      const { getByTestId } = setup({ accept: 'image/*' })

      fireEvent.click(getByTestId('double-click-file-btn'))

      expect(mockOnFileDoubleClick).not.toHaveBeenCalled()
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should block repeated double-clicks during processing', async () => {
      // First call never resolves — lock stays engaged
      let resolveFirst
      mockOnFileDoubleClick.mockReturnValue(
        new Promise(resolve => {
          resolveFirst = resolve
        })
      )
      const { getByTestId } = setup()

      fireEvent.click(getByTestId('double-click-file-btn'))
      fireEvent.click(getByTestId('double-click-file-btn'))
      fireEvent.click(getByTestId('double-click-file-btn'))

      expect(mockOnFileDoubleClick).toHaveBeenCalledTimes(1)

      resolveFirst(filePickerDoubleClickResults.OPEN_MODAL)
      await waitFor(() =>
        expect(getByTestId('link-access-modal')).toBeInTheDocument()
      )
    })

    it('should release lock after error so user can retry', async () => {
      mockOnFileDoubleClick.mockResolvedValueOnce('SHARING_LINK_FAILED')
      const { getByTestId, queryByTestId } = setup()

      fireEvent.click(getByTestId('double-click-file-btn'))

      await waitFor(() =>
        expect(getByTestId('file-picker-error')).toBeInTheDocument()
      )

      // Second double-click should trigger a new call
      mockOnFileDoubleClick.mockResolvedValueOnce(
        filePickerDoubleClickResults.OPEN_MODAL
      )
      fireEvent.click(getByTestId('double-click-file-btn'))

      await waitFor(() =>
        expect(getByTestId('link-access-modal')).toBeInTheDocument()
      )
      expect(queryByTestId('file-picker-error')).toBeNull()
      expect(mockOnFileDoubleClick).toHaveBeenCalledTimes(2)
    })

    it('should replace multi-selection with the double-clicked file', async () => {
      mockOnFileDoubleClick.mockResolvedValue(
        filePickerDoubleClickResults.OPEN_MODAL
      )
      const { getByTestId } = setup({ multiple: true })

      // Create a multi-selection
      fireEvent.click(getByTestId('select-file-btn'))
      fireEvent.click(getByTestId('select-second-file-btn'))

      // Double-click a file
      fireEvent.click(getByTestId('double-click-file-btn'))

      await waitFor(() =>
        expect(getByTestId('link-access-modal')).toHaveTextContent('file.pdf')
      )
      // The modal should show only the double-clicked file, not the second one
      expect(getByTestId('link-access-modal')).not.toHaveTextContent(
        'second-file.pdf'
      )
    })

    it('should display download error when onFileDoubleClick rejects', async () => {
      mockOnFileDoubleClick.mockRejectedValue(new Error('download failed'))
      const { getByTestId } = setup({
        filePickerConfig: {
          sharingLink: null,
          downloadLink: { allowFolder: false }
        }
      })

      fireEvent.click(getByTestId('double-click-file-btn'))

      await waitFor(() =>
        expect(getByTestId('file-picker-error')).toBeInTheDocument()
      )
    })
  })
})
