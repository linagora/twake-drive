import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

import { useClient } from 'cozy-client'

import {
  ViewSwitcherContextProvider,
  useViewSwitcherContext
} from './ViewSwitcherContext'

import { DOCTYPE_FILES_SETTINGS } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { usePublicContext } from '@/modules/public/PublicProvider'

jest.mock('cozy-client', () => ({
  useClient: jest.fn(),
  Q: jest.fn().mockReturnValue('mocked-query')
}))

jest.mock('@/lib/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}))

jest.mock('@/modules/public/PublicProvider', () => ({
  usePublicContext: jest.fn()
}))

const mockUseClient = useClient
const mockUsePublicContext = usePublicContext

const wrapper = ({ children }) => (
  <ViewSwitcherContextProvider>{children}</ViewSwitcherContextProvider>
)

describe('ViewSwitcherContext', () => {
  let mockClient

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      save: jest.fn().mockResolvedValue({}),
      query: jest.fn().mockResolvedValue({ data: [] })
    }
    mockUseClient.mockReturnValue(mockClient)

    mockUsePublicContext.mockReturnValue({ isPublic: false })
  })

  it('loads the preferred view type from settings', async () => {
    mockClient.query.mockResolvedValue({
      data: [{ attributes: { preferredDriveViewType: 'grid' } }]
    })

    const { result } = renderHook(() => useViewSwitcherContext(), { wrapper })

    await waitFor(() => expect(result.current.viewType).toBe('grid'))

    expect(mockClient.query).toHaveBeenCalledWith('mocked-query')
  })

  it('does not query settings in public view', async () => {
    mockUsePublicContext.mockReturnValue({ isPublic: true })

    const { result } = renderHook(() => useViewSwitcherContext(), { wrapper })

    expect(result.current.viewType).toBe('list')
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('does not persist the view type in public view', async () => {
    mockUsePublicContext.mockReturnValue({ isPublic: true })

    const { result } = renderHook(() => useViewSwitcherContext(), { wrapper })

    await act(async () => {
      await result.current.switchView('grid')
    })

    expect(result.current.viewType).toBe('grid')
    expect(mockClient.save).not.toHaveBeenCalled()
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'Cannot persist view: in public view'
    )
  })

  it('persists the preferred view type when not in public view', async () => {
    const existing = {
      _id: 'settings-id',
      _type: DOCTYPE_FILES_SETTINGS,
      attributes: { preferredDriveViewType: 'list' }
    }
    // First call is the mount load, second is switchView's read-before-save.
    mockClient.query
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [existing] })

    const { result } = renderHook(() => useViewSwitcherContext(), { wrapper })

    await act(async () => {
      await result.current.switchView('grid')
    })

    expect(mockClient.save).toHaveBeenCalledWith({
      ...existing,
      attributes: { preferredDriveViewType: 'grid' }
    })
  })

  it('keeps DOCTYPE_FILES_SETTINGS as the queried doctype', async () => {
    renderHook(() => useViewSwitcherContext(), { wrapper })

    await waitFor(() => expect(mockClient.query).toHaveBeenCalled())

    const { Q } = jest.requireMock('cozy-client')
    expect(Q).toHaveBeenCalledWith(DOCTYPE_FILES_SETTINGS)
  })
})
