import { renderHook } from '@testing-library/react'

import { useFileShareNavigate } from './useFileShareNavigate'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()

jest.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate
}))

describe('useFileShareNavigate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocation.mockReturnValue({
      pathname: '/sharings',
      search: '?tab=by-me'
    })
  })

  it('preserves the active Sharings tab when opening the dialog', () => {
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn()
    }
    const { result } = renderHook(() =>
      useFileShareNavigate({ file: { id: 'file-1' }, disabled: false })
    )

    result.current(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/sharings/file/file-1/share',
      search: '?tab=by-me'
    })
  })
})
