import { renderHook, waitFor } from '@testing-library/react'

import { isQueryLoading, useClient, useQuery } from 'cozy-client'

import { useEditorAuthor } from './useEditorAuthor'

jest.mock('cozy-client', () => ({
  useClient: jest.fn(),
  useQuery: jest.fn(),
  isQueryLoading: jest.fn(() => false)
}))
jest.mock('@/lib/logger', () => ({ warn: jest.fn(), error: jest.fn() }))
jest.mock('@/queries', () => ({
  buildSettingsByIdQuery: () => ({ definition: jest.fn(), options: {} })
}))

const mockClient = fetchOwnPermissions => {
  useClient.mockReturnValue({
    collection: () => ({ fetchOwnPermissions })
  })
}

describe('useEditorAuthor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    isQueryLoading.mockReturnValue(false)
    useQuery.mockReturnValue({ data: undefined })
    window.history.replaceState({}, '', '/')
  })

  describe('private', () => {
    it("returns the instance owner's public_name", () => {
      useQuery.mockReturnValue({ data: { public_name: 'Alice' } })
      mockClient(jest.fn())

      const { result } = renderHook(() => useEditorAuthor({ isPublic: false }))

      expect(result.current.author).toBe('Alice')
    })
  })

  describe('public', () => {
    it("resolves the recipient's name from the token", async () => {
      mockClient(
        jest.fn().mockResolvedValue({
          included: [{ attributes: { public_name: 'Bob' } }]
        })
      )

      const { result } = renderHook(() => useEditorAuthor({ isPublic: true }))

      await waitFor(() => expect(result.current.author).toBe('Bob'))
    })

    it('falls back to the username in the share URL when the token has none', async () => {
      window.history.replaceState({}, '', '/?username=Carol')
      mockClient(jest.fn().mockResolvedValue({ included: [] }))

      const { result } = renderHook(() => useEditorAuthor({ isPublic: true }))

      await waitFor(() => expect(result.current.author).toBe('Carol'))
    })

    it('stays undefined for an anonymous link share', async () => {
      mockClient(jest.fn().mockResolvedValue({ included: [] }))

      const { result } = renderHook(() => useEditorAuthor({ isPublic: true }))

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.author).toBeUndefined()
    })

    it('does not query the instance settings in public mode', async () => {
      mockClient(jest.fn().mockResolvedValue({ included: [] }))

      const { result } = renderHook(() => useEditorAuthor({ isPublic: true }))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(useQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false })
      )
    })
  })
})
