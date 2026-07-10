import { fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'

import { filePickerLinkModes } from './constants'
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

jest.mock('cozy-ui/transpiled/react/CozyDialogs', () => ({
  FixedDialog: ({ title, content, actions }) => (
    <div>
      <div data-testid="dialog-title">{title}</div>
      <div data-testid="dialog-content">{content}</div>
      <div data-testid="dialog-actions">{actions}</div>
    </div>
  )
}))

jest.mock('./FilePickerHeader', () => () => <div>Header</div>)

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

  return ({ folderSelectable, navigateTo }) => {
    const { setSelectedItems } = useSelectionContext()

    return (
      <div>
        <span data-testid="folder-selectable">
          {folderSelectable ? 'true' : 'false'}
        </span>
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

const FilePickerWrapper = ({ children }) => (
  <SelectionProvider clearOnLocationChange={false}>
    {children}
  </SelectionProvider>
)

describe('FilePicker', () => {
  const mockOnChange = jest.fn()
  const mockOnClose = jest.fn()

  const setup = ({ filePickerConfig, multiple = false } = {}) => {
    return render(
      <FilePickerWrapper>
        <FilePicker
          onChange={mockOnChange}
          onClose={mockOnClose}
          filePickerConfig={filePickerConfig}
          multiple={multiple}
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

  it('should keep simple file selection until an action is chosen', async () => {
    const { getByTestId } = setup()

    expect(getByTestId('public-link-btn')).toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()

    fireEvent.click(getByTestId('select-file-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).not.toBeDisabled()
    expect(mockOnChange).not.toHaveBeenCalled()

    fireEvent.click(getByTestId('public-link-btn'))

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith(
        'file-id',
        filePickerLinkModes.PUBLIC_LINK
      )
    )
  })

  it('should disable temporary download link when a folder is selected', () => {
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('select-folder-btn'))

    expect(getByTestId('public-link-btn')).not.toBeDisabled()
    expect(getByTestId('temporary-download-link-btn')).toBeDisabled()
  })

  it('should keep multiple selected file ids until an action is chosen', async () => {
    const { getByTestId } = setup({ multiple: true })

    fireEvent.click(getByTestId('select-file-btn'))
    fireEvent.click(getByTestId('select-second-file-btn'))
    fireEvent.click(getByTestId('public-link-btn'))

    await waitFor(() =>
      expect(mockOnChange).toHaveBeenCalledWith(
        ['file-id', 'second-file-id'],
        filePickerLinkModes.PUBLIC_LINK
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
})
