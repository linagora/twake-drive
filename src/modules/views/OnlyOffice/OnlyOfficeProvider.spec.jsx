import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'

import { useClient, useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import {
  OnlyOfficeProvider,
  useOnlyOfficeContext
} from '@/modules/views/OnlyOffice/OnlyOfficeProvider'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn(),
  useQuery: jest.fn()
}))
jest.mock('cozy-sharing', () => ({
  ...jest.requireActual('cozy-sharing'),
  useSharingContext: jest.fn()
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: jest.fn()
}))
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams()]
}))

const wrapper = ({ children }) => (
  <OnlyOfficeProvider fileId="file-id" driveId="drive-id" isReadOnly={false}>
    {children}
  </OnlyOfficeProvider>
)

describe('OnlyOfficeProvider', () => {
  it('switches to view mode when write access is revoked and back when restored', async () => {
    const hasWriteAccess = jest.fn(() => true)
    useSharingContext.mockReturnValue({ hasWriteAccess })
    useBreakpoints.mockReturnValue({ isDesktop: true, isMobile: false })
    useQuery.mockReturnValue({ data: { trashed: false } })
    useClient.mockReturnValue({
      plugins: {
        realtime: { subscribe: jest.fn(), unsubscribe: jest.fn() }
      }
    })

    const { result, rerender } = renderHook(() => useOnlyOfficeContext(), {
      wrapper
    })

    await waitFor(() => expect(result.current.editorMode).toBe('edit'))
    expect(result.current.isEditorModeView).toBe(false)
    expect(result.current.isReadOnly).toBe(false)

    hasWriteAccess.mockReturnValue(false)
    rerender()
    expect(result.current.editorMode).toBe('view')
    expect(result.current.isEditorModeView).toBe(true)
    expect(result.current.isReadOnly).toBe(true)

    hasWriteAccess.mockReturnValue(true)
    rerender()
    expect(result.current.editorMode).toBe('edit')
    expect(result.current.isEditorModeView).toBe(false)
    expect(result.current.isReadOnly).toBe(false)
  })
})
