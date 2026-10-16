import { renderHook } from '@testing-library/react'
import { useNavigate } from 'react-router-dom'

import { useTrashRedirect } from './useTrashRedirect'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn()
}))

describe('useTrashRedirect', () => {
  const navigate = jest.fn()

  beforeEach(() => {
    navigate.mockClear()
    useNavigate.mockReturnValue(navigate)
  })

  it('opens a trashed folder in the trash', () => {
    renderHook(() =>
      useTrashRedirect({ id: 'trashed-id', path: '/.cozy_trash/Projects' })
    )

    expect(navigate).toHaveBeenCalledWith('/trash/trashed-id')
  })

  it('keeps a live folder whose name starts like the trash in the drive', () => {
    renderHook(() =>
      useTrashRedirect({ id: 'live-id', path: '/.cozy_trash_backup' })
    )

    expect(navigate).not.toHaveBeenCalled()
  })
})
