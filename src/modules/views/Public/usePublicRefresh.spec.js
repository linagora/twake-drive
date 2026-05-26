import { renderHook, act } from '@testing-library/react'

import { usePublicRefresh } from './usePublicRefresh'

describe('usePublicRefresh', () => {
  let forceRefetch
  let sharingRefresh
  let filesResult

  beforeEach(() => {
    forceRefetch = jest.fn()
    sharingRefresh = jest.fn()
    filesResult = { forceRefetch }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('refreshFolderContent', () => {
    it('calls filesResult.forceRefetch()', () => {
      const { result } = renderHook(() =>
        usePublicRefresh({ filesResult, sharingRefresh })
      )

      act(() => {
        result.current.refreshFolderContent()
      })

      expect(forceRefetch).toHaveBeenCalledTimes(1)
    })

    it('does not call sharingRefresh', () => {
      const { result } = renderHook(() =>
        usePublicRefresh({ filesResult, sharingRefresh })
      )

      act(() => {
        result.current.refreshFolderContent()
      })

      expect(sharingRefresh).not.toHaveBeenCalled()
    })
  })

  describe('refreshAfterChange', () => {
    it('calls sharingRefresh()', () => {
      const { result } = renderHook(() =>
        usePublicRefresh({ filesResult, sharingRefresh })
      )

      act(() => {
        result.current.refreshAfterChange()
      })

      expect(sharingRefresh).toHaveBeenCalledTimes(1)
    })

    it('calls refreshFolderContent (forceRefetch)', () => {
      const { result } = renderHook(() =>
        usePublicRefresh({ filesResult, sharingRefresh })
      )

      act(() => {
        result.current.refreshAfterChange()
      })

      expect(forceRefetch).toHaveBeenCalledTimes(1)
    })

    it('calls both sharingRefresh and forceRefetch in one invocation', () => {
      const callOrder = []
      const trackedSharingRefresh = jest.fn(() => callOrder.push('sharing'))
      const trackedForceRefetch = jest.fn(() => callOrder.push('forceRefetch'))

      const { result } = renderHook(() =>
        usePublicRefresh({
          filesResult: { forceRefetch: trackedForceRefetch },
          sharingRefresh: trackedSharingRefresh
        })
      )

      act(() => {
        result.current.refreshAfterChange()
      })

      expect(callOrder).toEqual(['sharing', 'forceRefetch'])
    })
  })

  describe('memoization of refreshFolderContent', () => {
    it('returns the same refreshFolderContent reference when filesResult does not change', () => {
      const { result, rerender } = renderHook(() =>
        usePublicRefresh({ filesResult, sharingRefresh })
      )

      const firstRef = result.current.refreshFolderContent
      rerender()
      expect(result.current.refreshFolderContent).toBe(firstRef)
    })

    it('returns a new refreshFolderContent reference when filesResult changes', () => {
      const { result, rerender } = renderHook(
        ({ fr }) => usePublicRefresh({ filesResult: fr, sharingRefresh }),
        { initialProps: { fr: filesResult } }
      )

      const firstRef = result.current.refreshFolderContent
      const newFilesResult = { forceRefetch: jest.fn() }
      rerender({ fr: newFilesResult })

      expect(result.current.refreshFolderContent).not.toBe(firstRef)
    })
  })

  describe('return shape', () => {
    it('returns refreshFolderContent and refreshAfterChange', () => {
      const { result } = renderHook(() =>
        usePublicRefresh({ filesResult, sharingRefresh })
      )

      expect(typeof result.current.refreshFolderContent).toBe('function')
      expect(typeof result.current.refreshAfterChange).toBe('function')
    })
  })
})