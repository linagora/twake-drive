import { renderHook, waitFor } from '@testing-library/react'

import { useClient, useQuery } from 'cozy-client'
import { useDataProxy } from 'cozy-dataproxy-lib'

import useDataProxyRecents from './useRecentFiles'

import logger from '@/lib/logger'
import { buildRecentQuery } from '@/queries'

jest.mock('cozy-client', () => ({
  useClient: jest.fn(),
  useQuery: jest.fn()
}))

jest.mock('cozy-dataproxy-lib', () => ({
  useDataProxy: jest.fn()
}))

jest.mock('@/lib/logger', () => ({
  warn: jest.fn(),
  error: jest.fn()
}))

jest.mock('@/queries', () => ({
  buildRecentQuery: jest.fn()
}))

const mockUseClient = useClient
const mockUseQuery = useQuery
const mockUseDataProxy = useDataProxy
const mockBuildRecentQuery = buildRecentQuery

const renderRecents = ({ dataProxy, useQueryResult, client } = {}) => {
  if (dataProxy) mockUseDataProxy.mockReturnValue(dataProxy)
  if (useQueryResult) mockUseQuery.mockReturnValue(useQueryResult)
  if (client !== undefined) mockUseClient.mockReturnValue(client)
  return renderHook(() => useDataProxyRecents())
}

describe('useDataProxyRecents', () => {
  let mockClient

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = {
      getDocumentFromState: jest.fn()
    }
    mockUseClient.mockReturnValue(mockClient)
    mockBuildRecentQuery.mockReturnValue({
      definition: jest.fn(() => ({})),
      options: {}
    })
    mockUseQuery.mockReturnValue({
      data: null,
      fetchStatus: 'loading',
      error: null
    })
  })

  describe('when dataProxy is available and succeeds', () => {
    it('should return data from dataProxy and filter trashed documents', async () => {
      const mockData = [
        { _id: '1', name: 'file1', trashed: false },
        { _id: '2', name: 'file2', trashed: true },
        { _id: '3', name: 'file3', trashed: false }
      ]
      const mockDataProxy = {
        dataProxyServicesAvailable: true,
        recents: jest.fn().mockResolvedValue(mockData)
      }

      // Simulate file3 trashed in store, file1 renamed in store
      mockClient.getDocumentFromState.mockImplementation((doctype, id) => {
        if (id === '3') return { _id: '3', trashed: true }
        if (id === '1')
          return { _id: '1', name: 'file1_renamed', trashed: false }
        return null
      })

      const { result } = renderRecents({ dataProxy: mockDataProxy })

      expect(result.current.fetchStatus).toBe('loading')
      expect(result.current.data).toEqual([])

      await waitFor(() => expect(result.current.fetchStatus).toBe('loaded'))

      expect(result.current.data).toEqual([
        { _id: '1', name: 'file1_renamed', trashed: false }
      ])
      expect(result.current.error).toBe(null)
      expect(mockDataProxy.recents).toHaveBeenCalledTimes(1)
      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe('when dataProxy throws an error', () => {
    it('should use fallback query when dataProxy fails', async () => {
      const mockError = new Error('DataProxy error')
      const mockDataProxy = {
        dataProxyServicesAvailable: true,
        recents: jest.fn().mockRejectedValue(mockError)
      }
      const fallbackData = [{ _id: '4', name: 'file4' }]

      const { result } = renderRecents({
        dataProxy: mockDataProxy,
        useQueryResult: {
          data: fallbackData,
          fetchStatus: 'loaded',
          error: null
        }
      })

      // Wait for proxy to fail and fallback to be used
      await waitFor(() => expect(result.current.fetchStatus).toBe('loaded'))

      expect(result.current.data).toEqual(fallbackData)
      expect(result.current.error).toBe(mockError)
      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching recents from dataproxy',
        mockError
      )
    })

    it('should handle fallback query error', async () => {
      const mockError = new Error('DataProxy error')
      const fallbackError = new Error('Fallback query error')
      const mockDataProxy = {
        dataProxyServicesAvailable: true,
        recents: jest.fn().mockRejectedValue(mockError)
      }

      const { result } = renderRecents({
        dataProxy: mockDataProxy,
        useQueryResult: {
          data: null,
          fetchStatus: 'failed',
          error: fallbackError
        }
      })

      // Wait for proxy to fail
      await waitFor(() => expect(result.current.fetchStatus).toBe('error'))

      expect(result.current.error).toEqual(fallbackError)
      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching recents from dataproxy',
        mockError
      )
      expect(logger.warn).toHaveBeenCalledWith(
        'Error fetching recents from fallback query',
        fallbackError
      )
    })
  })

  describe('when dataProxy is not available', () => {
    it('should use fallback query when dataProxy is not available', () => {
      const mockDataProxy = {
        dataProxyServicesAvailable: false
      }
      const fallbackData = [{ _id: '5', name: 'file5' }]

      const { result } = renderRecents({
        dataProxy: mockDataProxy,
        useQueryResult: {
          data: fallbackData,
          fetchStatus: 'loaded',
          error: null
        }
      })

      expect(result.current.fetchStatus).toBe('loaded')
      expect(result.current.data).toEqual(fallbackData)
    })

    it('should handle fallback query loading state', () => {
      const mockDataProxy = {
        dataProxyServicesAvailable: false
      }

      const { result } = renderRecents({
        dataProxy: mockDataProxy,
        useQueryResult: {
          data: null,
          fetchStatus: 'loading',
          error: null
        }
      })

      expect(result.current.fetchStatus).toBe('loading')
      expect(result.current.data).toEqual([])
      expect(result.current.error).toBe(null)
    })
  })

  describe('when client is not available', () => {
    it('should set error when client is not available', () => {
      const mockDataProxy = {
        dataProxyServicesAvailable: false
      }

      const { result } = renderRecents({
        dataProxy: mockDataProxy,
        client: null
      })

      expect(result.current.fetchStatus).toBe('error')
      expect(result.current.error).toEqual(new Error('Client not available'))
      expect(result.current.data).toEqual([])
    })
  })
})
