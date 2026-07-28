import { fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'

import { filePickerDoubleClickResults, filePickerLinkModes } from './constants'
import FilePicker from './index'

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

jest.mock('./FilePickerHeader', () => () => (
  <div data-testid="file-picker-header-inner">Header</div>
))

jest.mock('./FilePickerBody', () => {
  const {
    useSelectionContext
  } = require('@/modules/selection/SelectionProvider')

  const file = {
    _id: 'file-id',
    type: 'file',
    name: 'file.pdf'
  }

  const secondFile = {
    _id: 'second-file-id',
    type: 'file',
    name: 'second-file.pdf'
  }

  const folder = {
    _id: 'folder-id',
    id: 'folder-id',
    type: 'directory',
    name: 'Folder'
  }

  return ({ folderSelectable, navigateTo, onFileDoubleClick, error }) => {
    const { setSelectedItems } = useSelectionContext()

    return (
      <div>
        <span data-testid="folder-selectable">
          {folderSelectable ? 'true' : 'false'}
        </span>
        {error && <div data-testid="file-picker-error">{error}</div>}
        <button
          type="button"
          data-testid="select-file-btn"
          onClick={() => setSelectedItems({ [file._id]: file })}
        >
          Select file
        </button>
        <button
          type="button"
          data-testid="select-second-file-btn"
          onClick={() =>
            setSelectedItems({ [file._id]: file, [secondFile._id]: secondFile })
          }
        >
          Select second file
        </button>
        <button
          type="button"
          data-testid="select-folder-btn"
          onClick={() => setSelectedItems({ [folder._id]: folder })}
        >
          Select folder
        </button>
        <button
          type="button"
          data-testid="select-file-and-folder-btn"
          onClick={() =>
            setSelectedItems({ [file._id]: file, [folder._id]: folder })
          }
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
      </div>
    )
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

  const setup = ({
    filePickerConfig,
    multiple = false,
    onFileDoubleClick,
    accept
  } = {}) => {
    return render(
      <FilePickerWrapper>
        <FilePicker
          onChange={mockOnChange}
          onFileDoubleClick={onFileDoubleClick ?? mockOnFileDoubleClick}
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

  it('should render the header, content and footer', () => {
    const { getByTestId } = setup()

    expect(getByTestId('file-picker-header-inner')).toBeInTheDocument()
    expect(getByTestId('file-picker-body-wrapper')).toBeInTheDocument()
    expect(getByTestId('file-picker-footer')).toBeInTheDocument()
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
    const { getByTestId } = setup()

    expect(getByTestId('public-link-btn')).toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()

    fireEvent.click(getByTestId('select-file-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).not.toBeDisabled()
    expect(mockOnChange).not.toHaveBeenCalled()

    fireEvent.click(getByTestId('public-link-btn'))

    expect(getByTestId('link-access-modal')).toHaveTextContent('file.pdf')
    expect(mockOnChange).not.toHaveBeenCalled()

    fireEvent.click(getByTestId('confirm-link-access-btn'))

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith(
        [
          {
            _id: 'file-id',
            type: 'file',
            name: 'file.pdf'
          }
        ],
        filePickerLinkModes.PUBLIC_LINK,
        [{ documentId: 'file-id', url: 'https://file-id' }]
      )
    )
  })

  it('should keep link access open when link generation fails', async () => {
    mockOnChange.mockResolvedValueOnce('SHARING_LINK_FAILED')
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('public-link-btn'))
    fireEvent.click(getByTestId('confirm-link-access-btn'))

    await waitFor(() =>
      expect(getByTestId('link-access-modal')).toBeInTheDocument()
    )
    expect(mockShowAlert).toHaveBeenCalledWith({
      message: 'SHARING_LINK_FAILED',
      severity: 'error'
    })
  })

  it('should disable temporary download link when a folder is selected', () => {
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('select-folder-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()
  })

  it('should preserve multiple selected file ids while collecting link access', async () => {
    const { getByTestId } = setup({ multiple: true })

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('select-second-file-btn'))
    fireEvent.click(getByTestId('public-link-btn'))
    fireEvent.click(getByTestId('confirm-link-access-btn'))

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith(
        [
          { _id: 'file-id', type: 'file', name: 'file.pdf' },
          {
            _id: 'second-file-id',
            type: 'file',
            name: 'second-file.pdf'
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
            name: 'file.pdf'
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
          { _id: 'file-id', type: 'file', name: 'file.pdf' },
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
