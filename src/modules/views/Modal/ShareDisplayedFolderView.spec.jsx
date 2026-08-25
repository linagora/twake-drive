import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { ShareDisplayedFolderView } from './ShareDisplayedFolderView'
import { SharingModal } from './SharingModal'

import { SHARING_TAB_DRIVES, SHARING_TAB_WITH_ME } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation()
}))

jest.mock('cozy-flags', () => jest.fn())

jest.mock('./SharingModal', () => ({
  SharingModal: jest.fn(({ onRevokeSuccess }) => (
    <button onClick={onRevokeSuccess}>Revoke self</button>
  ))
}))

jest.mock('@/hooks', () => ({
  useDisplayedFolder: jest.fn()
}))

describe('ShareDisplayedFolderView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocation.mockReturnValue({ pathname: '/folder/folder-id/share' })
  })

  it('should redirect to the active tab after leaving a shared drive', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/sharings/drives/folder/folder-id/share'
    })
    useDisplayedFolder.mockReturnValue({
      displayedFolder: {
        driveId: 'drive-id',
        name: 'Shared folder'
      }
    })

    render(<ShareDisplayedFolderView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(
      `/sharings/${SHARING_TAB_DRIVES}`,
      {
        replace: true
      }
    )
  })

  it('should redirect to the sharings section after leaving a regular sharing', () => {
    useDisplayedFolder.mockReturnValue({
      displayedFolder: {
        name: 'Shared folder'
      }
    })

    render(<ShareDisplayedFolderView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(
      `/sharings/${SHARING_TAB_WITH_ME}`,
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

    SharingModal.mock.calls[0][0].onClose()

    expect(mockNavigate).toHaveBeenCalledWith('..', { replace: true })
  })
})
