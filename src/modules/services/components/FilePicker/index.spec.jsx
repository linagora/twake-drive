import { fireEvent, render } from '@testing-library/react'
import React from 'react'

import { filePickerLinkModes } from './constants'
import FilePicker from './index'

var mockIsMobile = false
var mockFolderDoc = null
var mockFolderLoaded = false

jest.mock('cozy-client', () => ({
  models: {
    file: {
      isDirectory: item => item?.type === 'directory',
      isFile: item => item?.type === 'file'
    }
  },
  Q: () => ({ getById: id => ({ id }) }),
  fetchPolicies: {
    olderThan: () => () => true
  },
  useQuery: () => ({ data: mockFolderDoc }),
  hasQueryBeenLoaded: () => mockFolderLoaded
}))

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: () => ({ isMobile: mockIsMobile })
}))

jest.mock('cozy-ui/transpiled/react/CozyDialogs', () => ({
  FixedDialog: ({ title, content, actions, onBack, onClose }) => (
    <div>
      <div data-testid="dialog-title">{title}</div>
      <div data-testid="dialog-content">{content}</div>
      <div data-testid="dialog-actions">{actions}</div>
      {onBack && (
        <button type="button" data-testid="back-btn" onClick={onBack}>
          Back
        </button>
      )}
      {onClose && (
        <button type="button" data-testid="close-btn" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  )
}))

jest.mock('./FilePickerHeader', () => () => <div>Header</div>)

jest.mock(
  './FilePickerBody',
  () =>
    ({ onSelectItemId, folderSelectable, navigateTo, folderId }) => (
      <div>
        <span data-testid="folder-selectable">
          {folderSelectable ? 'true' : 'false'}
        </span>
        <span data-testid="current-folder">{folderId}</span>
        <button
          type="button"
          data-testid="navigate-subfolder-btn"
          onClick={() => navigateTo({ id: 'subfolder-id' })}
        >
          Open subfolder
        </button>
        <button
          type="button"
          data-testid="select-file-btn"
          onClick={() =>
            onSelectItemId(['file-id'], {
              _id: 'file-id',
              type: 'file',
              name: 'file.pdf'
            })
          }
        >
          Select file
        </button>
        <button
          type="button"
          data-testid="select-folder-btn"
          onClick={() =>
            onSelectItemId(['folder-id'], {
              _id: 'folder-id',
              type: 'directory',
              name: 'Folder'
            })
          }
        >
          Select folder
        </button>
      </div>
    )
)

jest.mock(
  './FilePickerFooter',
  () =>
    ({
      onConfirm,
      publicLinkState,
      downloadLinkState,
      referenceState,
      publicLinkAction,
      downloadLinkAction,
      referenceAction
    }) => (
      <div>
        {referenceAction && (
          <button
            type="button"
            data-testid="reference-btn"
            disabled={referenceState?.disabled}
            onClick={() => onConfirm('reference')}
          >
            {referenceAction.label || 'Reference'}
          </button>
        )}
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

describe('FilePicker', () => {
  const mockOnChange = jest.fn()
  const mockOnClose = jest.fn()

  const setup = ({ filePickerConfig } = {}) => {
    return render(
      <FilePicker
        onChange={mockOnChange}
        onClose={mockOnClose}
        filePickerConfig={filePickerConfig}
      />
    )
  }

  afterEach(() => {
    jest.clearAllMocks()
    mockIsMobile = false
    mockFolderDoc = null
    mockFolderLoaded = false
  })

  it('should render both action buttons by default', () => {
    const { getByTestId } = setup()

    expect(getByTestId('public-link-btn')).toBeInTheDocument()
    expect(getByTestId('temporary-download-link-btn')).toBeInTheDocument()
  })

  it('should hide the reference button by default', () => {
    const { queryByTestId } = setup()

    expect(queryByTestId('reference-btn')).toBeNull()
  })

  it('should show and wire the reference button when the config enables it', () => {
    const { getByTestId } = setup({
      filePickerConfig: {
        sharingLink: null,
        downloadLink: null,
        reference: { label: 'Select this folder' }
      }
    })

    expect(getByTestId('reference-btn')).toHaveTextContent('Select this folder')

    fireEvent.click(getByTestId('select-folder-btn'))
    fireEvent.click(getByTestId('reference-btn'))

    expect(mockOnChange).toHaveBeenCalledWith(
      'folder-id',
      filePickerLinkModes.REFERENCE
    )
  })

  it('should not render a back button on desktop (breakpoints.isMobile false)', () => {
    mockIsMobile = false
    const { queryByTestId, getByTestId } = setup()

    expect(queryByTestId('back-btn')).toBeNull()
    expect(getByTestId('close-btn')).toBeInTheDocument()
  })

  it('should call onClose from the back button on mobile when at the root folder', () => {
    mockIsMobile = true
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('back-btn'))

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should navigate up one level from the back button on mobile inside a subfolder', () => {
    mockIsMobile = true
    mockFolderDoc = {
      _id: 'subfolder-id',
      dir_id: 'parent-id',
      type: 'directory'
    }
    mockFolderLoaded = true
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('navigate-subfolder-btn'))
    fireEvent.click(getByTestId('back-btn'))

    expect(getByTestId('current-folder')).toHaveTextContent('parent-id')
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should ignore the back button while the folder doc is still loading', () => {
    mockIsMobile = true
    mockFolderDoc = null
    mockFolderLoaded = false
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('navigate-subfolder-btn'))
    fireEvent.click(getByTestId('back-btn'))

    expect(getByTestId('current-folder')).toHaveTextContent('subfolder-id')
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should close from the back button when the folder doc is unavailable', () => {
    mockIsMobile = true
    mockFolderDoc = null
    mockFolderLoaded = true
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('navigate-subfolder-btn'))
    fireEvent.click(getByTestId('back-btn'))

    expect(mockOnClose).toHaveBeenCalled()
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

  it('should keep simple file selection until an action is chosen', () => {
    const { getByTestId } = setup()

    expect(getByTestId('public-link-btn')).toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()

    fireEvent.click(getByTestId('select-file-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).not.toBeDisabled()
    expect(mockOnChange).not.toHaveBeenCalled()

    fireEvent.click(getByTestId('public-link-btn'))

    expect(mockOnChange).toHaveBeenCalledWith(
      'file-id',
      filePickerLinkModes.PUBLIC_LINK
    )
  })

  it('should disable temporary download link when a folder is selected', () => {
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('select-folder-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()
  })
})
