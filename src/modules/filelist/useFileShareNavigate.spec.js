import { act, renderHook } from '@testing-library/react'

import { useFileShareNavigate } from './useFileShareNavigate'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '/sharings/with-me',
    search: '?f.type=document'
  }),
  useNavigate: () => mockNavigate
}))

describe('useFileShareNavigate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('preserves search params when opening the share modal', () => {
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn()
    }
    const { result } = renderHook(() =>
      useFileShareNavigate({ file: { id: 'file-id' }, disabled: false })
    )

    act(() => result.current(event))

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/sharings/with-me/file/file-id/share',
      search: '?f.type=document'
    })
  })
})
