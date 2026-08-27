import { fireEvent, render } from '@testing-library/react'
import React from 'react'
import { useDispatch } from 'react-redux'

import { useClient } from 'cozy-client'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { UploadButtonBase } from './UploadButton'

import { uploadFiles } from '@/modules/navigation/duck'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

jest.mock('@linagora/twake-icons', () => ({
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
    function FileInput({ children, onChange }) {
      const handleClick = () => onChange(['file'])
      return (
        <button data-testid="upload-btn" onClick={handleClick}>
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
jest.mock('@/modules/upload/NewItemHighlightProvider', () => ({
  useNewItemHighlightContext: jest.fn()
}))

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
})
