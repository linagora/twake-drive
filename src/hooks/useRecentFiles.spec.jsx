import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'

import { useClient } from 'cozy-client'
import { useDataProxy } from 'cozy-dataproxy-lib'

import useDataProxyRecents from './useRecentFiles'

import logger from '@/lib/logger'
import { buildRecentQuery } from '@/queries'

jest.mock('cozy-client', () => ({
  useClient: jest.fn()
}))

jest.mock('cozy-dataproxy-lib', () => ({
  useDataProxy: jest.fn()
}))

jest.mock('@/lib/logger', () => ({
  warn: jest.fn()
}))

jest.mock('@/queries', () => ({
  buildRecentQuery: jest.fn()
}))

const mockUseClient = useClient
const mockUseDataProxy = useDataProxy
const mockBuildRecentQuery = buildRecentQuery

describe('useDataProxyRecents', () => {
  let mockClient

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = {
      fetchQueryAndGetFromState: jest.fn()
    }
    mockUseClient.mockReturnValue(mockClient)
    mockBuildRecentQuery.mockReturnValue({
      definition: jest.fn(() => ({})),
      options: {}
    })
  })

  describe('when dataProxy is available and succeeds', () => {
    it('should return data from dataProxy', async () => {
      const mockData = [
        { id: '1', name: 'file1' },
        { id: '2', name: 'file2' }
      ]
      const mockDataProxy = {
        dataProxyServicesAvailable: true,
        recents: jest.fn().mockResolvedValue(mockData)
      }

      mockUseDataProxy.mockReturnValue(mockDataProxy)

      const { result, waitForNextUpdate } = renderHook(() =>
        useDataProxyRecents()
      )

      expect(result.current.fetchStatus).toBe('loading')
      expect(result.current.data).toEqual([])

      await act(async () => {
        await waitForNextUpdate()
      })

      expect(result.current.fetchStatus).toBe('loaded')
      expect(result.current.data).toEqual(mockData)
      expect(result.current.error).toBe(null)
      expect(mockDataProxy.recents).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchQueryAndGetFromState).not.toHaveBeenCalled()
      expect(logger.warn).not.toHaveBeenCalled()
    })
  })

  describe('when dataProxy throws an error', () => {
    it('should use fallback query when dataProxy fails', async () => {
      const mockError = new Error('DataProxy error')
      const mockDataProxy = {
        dataProxyServicesAvailable: true,
        recents: jest.fn().mockRejectedValue(mockError)
      }
      const fallbackData = [
        { id: '3', name: 'file3' },
        { id: '4', name: 'file4' }
      ]

      mockUseDataProxy.mockReturnValue(mockDataProxy)
      mockClient.fetchQueryAndGetFromState.mockResolvedValue({
        data: fallbackData
      })

      const { result, waitForValueToChange } = renderHook(() =>
        useDataProxyRecents()
      )

      expect(result.current.fetchStatus).toBe('loading')
      expect(result.current.data).toEqual([])

      // Wait for fallback query to complete
      await act(async () => {
        await waitForValueToChange(() => result.current.fetchStatus, {
          timeout: 2000
        })
      })

      expect(result.current.fetchStatus).toBe('loaded')
      expect(result.current.data).toEqual(fallbackData)
      expect(result.current.error).toBe(null)
      expect(logger.warn).toHaveBeenCalledWith(
        'Error fetching recents from dataproxy',
        mockError
      )
      expect(mockClient.fetchQueryAndGetFromState).toHaveBeenCalledTimes(1)
      expect(mockClient.fetchQueryAndGetFromState).toHaveBeenCalledWith({
        definition: expect.any(Object),
        options: expect.any(Object)
      })
    })

    it('should handle fallback query error', async () => {
      const mockError = new Error('DataProxy error')
      const fallbackError = new Error('Fallback query error')
      const mockDataProxy = {
        dataProxyServicesAvailable: true,
        recents: jest.fn().mockRejectedValue(mockError)
      }

      mockUseDataProxy.mockReturnValue(mockDataProxy)
      mockClient.fetchQueryAndGetFromState.mockRejectedValue(fallbackError)

      const { result, waitForValueToChange } = renderHook(() =>
        useDataProxyRecents()
      )

      // Wait for fallback query error to be processed
      await act(async () => {
        await waitForValueToChange(() => result.current.fetchStatus, {
          timeout: 2000
        })
      })

      expect(result.current.fetchStatus).toBe('error')
      expect(result.current.error).toEqual(fallbackError)
      expect(logger.warn).toHaveBeenCalledWith(
        'Error fetching recents from dataproxy',
        mockError
      )
      expect(logger.warn).toHaveBeenCalledWith(
        'Error fetching recents from fallback query',
        fallbackError
      )
      expect(mockClient.fetchQueryAndGetFromState).toHaveBeenCalledTimes(1)
    })
  })

  describe('when dataProxy is not available', () => {
    it('should use fallback query when dataProxy is not available', async () => {
      const mockDataProxy = {
        dataProxyServicesAvailable: false
      }
      const fallbackData = [
        { id: '5', name: 'file5' },
        { id: '6', name: 'file6' }
      ]

      mockUseDataProxy.mockReturnValue(mockDataProxy)
      mockClient.fetchQueryAndGetFromState.mockResolvedValue({
        data: fallbackData
      })

      const { result, waitForNextUpdate } = renderHook(() =>
        useDataProxyRecents()
      )

      // When dataProxy is not available, the hook should execute fallback query
      expect(mockClient.fetchQueryAndGetFromState).toHaveBeenCalledTimes(1)

      // Wait for fallback query to complete
      await act(async () => {
        await waitForNextUpdate()
      })

      expect(result.current.fetchStatus).toBe('loaded')
      expect(result.current.data).toEqual(fallbackData)
      expect(mockClient.fetchQueryAndGetFromState).toHaveBeenCalledWith({
        definition: expect.any(Object),
        options: expect.any(Object)
      })
    })

    it('should handle fallback query loading state', async () => {
      const mockDataProxy = {
        dataProxyServicesAvailable: false
      }

      mockUseDataProxy.mockReturnValue(mockDataProxy)
      // Don't resolve the query immediately to test loading state
      mockClient.fetchQueryAndGetFromState.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useDataProxyRecents())

      expect(result.current.fetchStatus).toBe('loading')
      expect(result.current.data).toEqual([])
      expect(result.current.error).toBe(null)
      expect(mockClient.fetchQueryAndGetFromState).toHaveBeenCalledTimes(1)
    })
  })

  describe('when client is not available', () => {
    it('should set error when client is not available', async () => {
      const mockDataProxy = {
        dataProxyServicesAvailable: false
      }

      mockUseDataProxy.mockReturnValue(mockDataProxy)
      mockUseClient.mockReturnValue(null)

      const { result, waitFor } = renderHook(() => useDataProxyRecents())

      // Wait for error to be set
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('error')
      })

      expect(result.current.error).toEqual(new Error('Client not available'))
      expect(result.current.data).toEqual([])
      expect(mockClient.fetchQueryAndGetFromState).not.toHaveBeenCalled()
    })
  })
})
