import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'

import { ShareFileView } from './ShareFileView'

import { SHARING_TAB_BY_ME, SHARING_TAB_WITH_ME } from '@/constants/config'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()
const mockUseParams = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
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
    mockUseLocation.mockReturnValue({ pathname: '/folder/folder-id' })
    hasQueryBeenLoaded.mockReturnValue(true)
    useQuery.mockReturnValue({
      data: {
        id: 'file-id',
        name: 'Shared file'
      },
      fetchStatus: 'loaded'
    })
  })

  it('should redirect to the active tab after leaving a shared drive file', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/sharings/by-me/shareddrive/drive-id/file-id/share'
    })
    mockUseParams.mockReturnValue({ driveId: 'drive-id', fileId: 'file-id' })

    render(<ShareFileView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(
      `/sharings/${SHARING_TAB_BY_ME}`,
      {
        replace: true
      }
    )
  })

  it('should redirect to the sharings section after leaving a regular sharing', () => {
    mockUseParams.mockReturnValue({ fileId: 'file-id' })

    render(<ShareFileView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(
      `/sharings/${SHARING_TAB_WITH_ME}`,
      { replace: true }
    )
  })
})
