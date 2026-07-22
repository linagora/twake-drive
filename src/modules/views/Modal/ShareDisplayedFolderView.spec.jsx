import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { ShareModal } from 'cozy-sharing'

import { ShareDisplayedFolderView } from './ShareDisplayedFolderView'

import {
  DEFAULT_SHARINGS_VIEW_ROUTE,
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES
} from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate
}))

jest.mock('cozy-flags', () => jest.fn())

jest.mock('cozy-sharing', () => ({
  ShareModal: jest.fn(({ onRevokeSuccess }) => (
    <button onClick={onRevokeSuccess}>Revoke self</button>
  ))
}))

jest.mock('@/hooks', () => ({
  useDisplayedFolder: jest.fn()
}))

describe('ShareDisplayedFolderView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocation.mockReturnValue({
      pathname: '/sharings/folder/folder-id/share',
      search: `?tab=${SHARING_TAB_BY_ME}`
    })
  })

  it('should preserve the drives tab after leaving a shared drive', () => {
    useDisplayedFolder.mockReturnValue({
      displayedFolder: {
        driveId: 'drive-id',
        name: 'Shared folder'
      }
    })
    mockUseLocation.mockReturnValue({
      pathname: '/sharings/shareddrive/drive-id/folder-id/share',
      search: `?tab=${SHARING_TAB_DRIVES}`
    })

    render(<ShareDisplayedFolderView />)

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
    useDisplayedFolder.mockReturnValue({
      displayedFolder: {
        name: 'Shared folder'
      }
    })

    render(<ShareDisplayedFolderView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(
      {
        pathname: '/sharings',
        search: `?tab=${SHARING_TAB_BY_ME}`
      },
      { replace: true }
    )
  })

  it('should keep passing onClose to the share modal', () => {
    useDisplayedFolder.mockReturnValue({
      displayedFolder: {
        name: 'Shared folder'
      }
    })

    render(<ShareDisplayedFolderView />)

    ShareModal.mock.calls[0][0].onClose()

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '..', search: `?tab=${SHARING_TAB_BY_ME}` },
      { replace: true }
    )
  })

  it('should use the default Sharings route outside the section', () => {
    useDisplayedFolder.mockReturnValue({
      displayedFolder: {
        name: 'Shared folder'
      }
    })
    mockUseLocation.mockReturnValue({
      pathname: '/folder/folder-id/share',
      search: ''
    })

    render(<ShareDisplayedFolderView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(DEFAULT_SHARINGS_VIEW_ROUTE, {
      replace: true
    })
  })
})
