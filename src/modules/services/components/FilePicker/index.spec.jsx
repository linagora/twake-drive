import { fireEvent, render } from '@testing-library/react'
import React from 'react'

import { filePickerLinkModes } from './constants'
import FilePicker from './index'

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

jest.mock('./FilePickerBody', () => ({ onSelectItemId, folderSelectable }) => (
  <div>
    <span data-testid="folder-selectable">
      {folderSelectable ? 'true' : 'false'}
    </span>
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
))

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
