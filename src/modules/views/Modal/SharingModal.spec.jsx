import { render } from '@testing-library/react'
import React from 'react'

import flag from 'cozy-flags'
import {
  FederatedFolderModal,
  ShareModal,
  useSharingContext
} from 'cozy-sharing'

import { SharingModal } from './SharingModal'

jest.mock('cozy-flags', () => jest.fn())

jest.mock('cozy-sharing', () => ({
  FederatedFolderModal: jest.fn(() => <div>federated</div>),
  ShareModal: jest.fn(() => <div>classic</div>),
  useSharingContext: jest.fn()
}))

const DOCUMENT = { id: 'folder-id', name: 'Folder' }

const mockSharingContext = ({
  sharings = [],
  owner = true,
  reshare = false
} = {}) => {
  useSharingContext.mockReturnValue({
    byDocId: sharings.length > 0 ? { [DOCUMENT.id]: { sharings } } : {},
    isOwner: () => owner,
    canReshare: () => reshare
  })
}

describe('SharingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    flag.mockImplementation(
      name => name === 'drive.federated-shared-folder.enabled'
    )
  })

  it('opens the federated modal for a document that is not shared yet', () => {
    mockSharingContext()

    render(<SharingModal document={DOCUMENT} />)

    expect(FederatedFolderModal).toHaveBeenCalled()
    expect(ShareModal).not.toHaveBeenCalled()
  })

  it('opens the federated modal when the user can reshare', () => {
    mockSharingContext({
      sharings: ['sharing-id'],
      owner: false,
      reshare: true
    })

    render(<SharingModal document={DOCUMENT} />)

    expect(FederatedFolderModal).toHaveBeenCalled()
  })

  it('falls back to cozy-sharing when the user can neither own nor reshare', () => {
    mockSharingContext({ sharings: ['sharing-id'], owner: false })

    render(<SharingModal document={DOCUMENT} />)

    expect(ShareModal).toHaveBeenCalled()
    expect(FederatedFolderModal).not.toHaveBeenCalled()
  })

  it('falls back to cozy-sharing when the federated flag is off', () => {
    flag.mockReturnValue(false)
    mockSharingContext()

    render(<SharingModal document={DOCUMENT} />)

    expect(ShareModal).toHaveBeenCalled()
    expect(FederatedFolderModal).not.toHaveBeenCalled()
  })
})
