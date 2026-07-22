import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'
import { ShareModal } from 'cozy-sharing'

import { ShareFileView } from './ShareFileView'

import {
  DEFAULT_SHARINGS_VIEW_ROUTE,
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES
} from '@/constants/config'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()
const mockUseParams = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams()
}))

jest.mock('cozy-client', () => ({
  hasQueryBeenLoaded: jest.fn(),
  useQuery: jest.fn()
}))

jest.mock('cozy-flags', () => jest.fn())

jest.mock('cozy-sharing', () => ({
  ShareModal: jest.fn(({ onRevokeSuccess }) => (
    <button onClick={() => onRevokeSuccess({ id: 'file-id' })}>
      Revoke self
    </button>
  ))
}))

jest.mock('@/components/LoaderModal', () => ({
  LoaderModal: () => <div>Loading</div>
}))

jest.mock('@/queries', () => ({
  buildFileOrFolderByIdQuery: jest.fn(() => ({
    definition: 'file-definition',
    options: {}
  })),
  buildSharedDriveFileOrFolderByIdQuery: jest.fn(() => ({
    definition: 'shared-drive-file-definition',
    options: {}
  }))
}))

describe('ShareFileView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocation.mockReturnValue({
      pathname: '/sharings/file/file-id/share',
      search: `?tab=${SHARING_TAB_BY_ME}`
    })
    hasQueryBeenLoaded.mockReturnValue(true)
    useQuery.mockReturnValue({
      data: {
        id: 'file-id',
        name: 'Shared file'
      },
      fetchStatus: 'loaded'
    })
  })

  it('should preserve the drives tab after leaving a shared drive file', () => {
    mockUseParams.mockReturnValue({ driveId: 'drive-id', fileId: 'file-id' })
    mockUseLocation.mockReturnValue({
      pathname: '/sharings/shareddrive/drive-id/file-id/share',
      search: `?tab=${SHARING_TAB_DRIVES}`
    })

    render(<ShareFileView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(
      {
        pathname: '/sharings',
        search: `?tab=${SHARING_TAB_DRIVES}`
      },
      {
        replace: true
      }
    )
  })

  it('should preserve the by-me tab after leaving a regular sharing', () => {
    mockUseParams.mockReturnValue({ fileId: 'file-id' })

    render(<ShareFileView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(
      {
        pathname: '/sharings',
        search: `?tab=${SHARING_TAB_BY_ME}`
      },
      { replace: true }
    )
  })

  it('should preserve the active tab when closing the modal', () => {
    mockUseParams.mockReturnValue({ fileId: 'file-id' })

    render(<ShareFileView />)

    const shareModalProps = ShareModal.mock.calls[0][0]
    shareModalProps.onClose()

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '..', search: `?tab=${SHARING_TAB_BY_ME}` },
      { replace: true }
    )
  })

  it('should use the default Sharings route outside the section', () => {
    mockUseParams.mockReturnValue({ fileId: 'file-id' })
    mockUseLocation.mockReturnValue({
      pathname: '/folder/folder-id/file/file-id/share',
      search: ''
    })

    render(<ShareFileView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(DEFAULT_SHARINGS_VIEW_ROUTE, {
      replace: true
    })
  })
})
