import { fireEvent, render } from '@testing-library/react'
import React from 'react'
import { useDispatch } from 'react-redux'

import { useClient } from 'cozy-client'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { UploadButtonBase } from './UploadButton'

import { uploadFiles } from '@/modules/navigation/duck'
import { isDirectoryPickerAvailable } from '@/modules/upload'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

jest.mock('@linagora/twake-icons', () => ({
  Folder: 'folder',
  Icon: () => null,
  Upload: 'upload'
}))
jest.mock('react-redux', () => ({ useDispatch: jest.fn() }))
jest.mock('cozy-client', () => ({ useClient: jest.fn() }))
jest.mock(
  'cozy-sharing/dist/hoc/withSharingState',
  () => component => component
)
jest.mock('cozy-ui/transpiled/react/Buttons', () => ({ label }) => (
  <span>{label}</span>
))
jest.mock(
  'cozy-ui/transpiled/react/FileInput',
  () =>
    function FileInput({ children, onChange, webkitdirectory, ...props }) {
      const handleClick = () => onChange(mockPickedFiles)
      return (
        <button
          data-testid={props['data-testid']}
          data-webkitdirectory={webkitdirectory}
          onClick={handleClick}
        >
          {children}
        </button>
      )
    }
)
jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  useAlert: jest.fn()
}))
jest.mock('twake-i18n', () => ({ useI18n: jest.fn() }))
jest.mock('@/modules/navigation/duck', () => ({ uploadFiles: jest.fn() }))
jest.mock('@/modules/public/PublicProvider', () => ({
  usePublicContext: () => ({ isPublic: false })
}))
jest.mock('@/modules/upload', () => ({
  isDirectoryPickerAvailable: jest.fn()
}))
jest.mock('@/modules/upload/NewItemHighlightProvider', () => ({
  useNewItemHighlightContext: jest.fn()
}))

let mockPickedFiles = ['file']

describe('UploadButton', () => {
  const client = { id: 'client' }
  const sharingState = { id: 'sharing-state' }
  const showAlert = jest.fn()
  const t = jest.fn()
  const addItems = jest.fn()
  const onUploaded = jest.fn()
  const dispatch = jest.fn()

  function setup(props = {}) {
    return render(
      <UploadButtonBase
        label="Upload"
        displayedFolder={{ id: 'document-folder', driveId: 'document-drive' }}
        sharingState={sharingState}
        onUploaded={onUploaded}
        {...props}
      />
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useClient.mockReturnValue(client)
    useDispatch.mockReturnValue(dispatch)
    useAlert.mockReturnValue({ showAlert })
    useI18n.mockReturnValue({ t })
    useNewItemHighlightContext.mockReturnValue({ addItems })
    uploadFiles.mockReturnValue({ type: 'UPLOAD_FILES' })
    isDirectoryPickerAvailable.mockReturnValue(true)
    mockPickedFiles = ['file']
  })

  it('uses route identifiers for a proxied shared-drive folder', () => {
    const { getByTestId } = setup({
      folderId: 'route-folder',
      driveId: 'route-drive'
    })

    fireEvent.click(getByTestId('upload-btn'))

    expect(uploadFiles).toHaveBeenCalledWith(
      ['file'],
      'route-folder',
      sharingState,
      onUploaded,
      { client, showAlert, t },
      'route-drive',
      addItems
    )
  })

  it('falls back to identifiers from the displayed folder', () => {
    const { getByTestId } = setup()

    fireEvent.click(getByTestId('upload-btn'))

    expect(uploadFiles).toHaveBeenCalledWith(
      ['file'],
      'document-folder',
      sharingState,
      onUploaded,
      { client, showAlert, t },
      'document-drive',
      addItems
    )
  })

  it('opens a directory picker and uploads through the same action', () => {
    const { getByTestId } = setup({ isDirectory: true })
    const input = getByTestId('upload-folder-btn')

    expect(input.getAttribute('data-webkitdirectory')).toBe('')
    fireEvent.click(input)

    expect(uploadFiles).toHaveBeenCalledWith(
      ['file'],
      'document-folder',
      sharingState,
      onUploaded,
      { client, showAlert, t },
      'document-drive',
      addItems
    )
  })

  it('does not render the folder entry without write access', () => {
    const { queryByText } = setup({ isDirectory: true, disabled: true })

    expect(queryByText('Upload')).toBe(null)
  })

  it('does not render the folder entry where the picker is unavailable', () => {
    isDirectoryPickerAvailable.mockReturnValue(false)
    const { queryByText } = setup({ isDirectory: true })

    expect(queryByText('Upload')).toBe(null)
  })

  it('starts nothing when the picked folder holds no file', () => {
    mockPickedFiles = []
    const onUploadStart = jest.fn()
    const { getByTestId } = setup({ isDirectory: true, onUploadStart })

    fireEvent.click(getByTestId('upload-folder-btn'))

    expect(onUploadStart).not.toHaveBeenCalled()
    expect(uploadFiles).not.toHaveBeenCalled()
  })
})
