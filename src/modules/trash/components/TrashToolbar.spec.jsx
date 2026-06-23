import { render, fireEvent, act, screen } from '@testing-library/react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import { createMockClient } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { TrashToolbar } from './TrashToolbar'
import AppLike from 'test/components/AppLike'

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  ...jest.requireActual('cozy-ui/transpiled/react/providers/Breakpoints'),
  __esModule: true,
  default: jest.fn(),
  useBreakpoints: jest.fn()
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn()
}))

describe('TrashToolbar', () => {
  it('asks for confirmation before emptying the trash', async () => {
    const mockClient = createMockClient({})
    const navigateMock = jest.fn()

    useBreakpoints.mockReturnValue({ isMobile: false })
    useNavigate.mockReturnValue(navigateMock)

    render(
      <AppLike client={mockClient}>
        <TrashToolbar disabled={false} emptyTrash={jest.fn()} />
      </AppLike>
    )

    const emptyTrashButton = screen.getByText('Empty trash')
    act(() => {
      fireEvent.click(emptyTrashButton)
    })

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('empty')
  })
})
