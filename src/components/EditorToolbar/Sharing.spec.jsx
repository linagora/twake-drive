import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import Sharing from './Sharing'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()

jest.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate
}))

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => () => ({
  isMobile: false
}))

jest.mock('cozy-sharing', () => ({
  ShareButton: ({ onClick }) => <button onClick={onClick}>Share</button>,
  SharedRecipients: () => null,
  ShareModal: ({ onRevokeSuccess }) => (
    <button onClick={onRevokeSuccess}>Revoke self</button>
  )
}))

describe('EditorToolbar Sharing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocation.mockReturnValue({ search: '' })
  })

  it('returns to the originating sharings tab after revoking access', () => {
    mockUseLocation.mockReturnValue({
      search: '?redirectLink=drive%23%2Fsharings%2Fby-me%2Ffile%2Ffile-id'
    })

    render(<Sharing file={{ _id: 'file-id', name: 'Document' }} />)

    fireEvent.click(screen.getByText('Share'))
    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith('/sharings/by-me', {
      replace: true
    })
  })

  it('falls back to with-me without a sharings return route', () => {
    render(<Sharing file={{ _id: 'file-id', name: 'Document' }} />)

    fireEvent.click(screen.getByText('Share'))
    fireEvent.click(screen.getByText('Revoke self'))

    expect(mockNavigate).toHaveBeenCalledWith('/sharings/with-me', {
      replace: true
    })
  })
})
