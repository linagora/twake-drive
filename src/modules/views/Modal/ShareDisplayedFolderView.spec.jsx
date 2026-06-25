import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { ShareModal } from 'cozy-sharing'

import { ShareDisplayedFolderView } from './ShareDisplayedFolderView'

import { SHARING_TAB_DRIVES } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
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
  })

  it('should redirect to the drives sharing tab after leaving a shared drive', () => {
    useDisplayedFolder.mockReturnValue({
      displayedFolder: {
        driveId: 'drive-id',
        name: 'Shared folder'
      }
    })

    render(<ShareDisplayedFolderView />)

    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith(
      `/sharings?tab=${SHARING_TAB_DRIVES}`,
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

    expect(mockNavigate).toHaveBeenCalledWith('/sharings', { replace: true })
  })

  it('should keep passing onClose to the share modal', () => {
    useDisplayedFolder.mockReturnValue({
      displayedFolder: {
        name: 'Shared folder'
      }
    })

    render(<ShareDisplayedFolderView />)

    ShareModal.mock.calls[0][0].onClose()

    expect(mockNavigate).toHaveBeenCalledWith('..', { replace: true })
  })
})
