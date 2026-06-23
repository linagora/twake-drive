import { renderHook, act, waitFor } from '@testing-library/react'

import { useClient } from 'cozy-client'

import { useSceneSync } from './useSceneSync'

jest.mock('cozy-client', () => ({ useClient: jest.fn() }))
jest.mock('@/lib/logger', () => ({ error: jest.fn() }))
jest.mock('@excalidraw/excalidraw', () => ({
  // version = number of elements, so [] and [1] differ
  getSceneVersion: elements => elements.length,
  // round-trippable serialization for the test; simulates stripping transient
  // appState (here: selectedElementIds).
  serializeAsJSON: (elements, appState, files) => {
    const { selectedElementIds, ...persisted } = appState || {}
    return JSON.stringify({ elements, appState: persisted, files })
  }
}))

const flushPromises = () => act(async () => {})
const emptyBinary = () => ({
  text: () => Promise.resolve(JSON.stringify({ elements: [] }))
})

describe('useSceneSync', () => {
  const updateFile = jest.fn().mockResolvedValue(undefined)
  const fetchFileContentById = jest.fn()
  const collection = jest.fn(() => ({ fetchFileContentById, updateFile }))

  beforeEach(() => {
    jest.clearAllMocks()
    fetchFileContentById.mockResolvedValue(emptyBinary())
    useClient.mockReturnValue({ collection })
  })

  describe('loading', () => {
    it('reads and parses the scene from the file binary', async () => {
      const scene = { type: 'excalidraw', elements: [{ id: 'a' }], files: {} }
      fetchFileContentById.mockResolvedValue({
        text: () => Promise.resolve(JSON.stringify(scene))
      })
      const file = { _id: 'f1', name: 'd.excalidraw' }

      const { result } = renderHook(() => useSceneSync(file))

      await waitFor(() => expect(result.current.status).toBe('loaded'))
      expect(fetchFileContentById).toHaveBeenCalledWith('f1')
      expect(result.current.scene).toEqual(scene)
    })

    it('falls back to an empty scene when the binary is not a valid scene', async () => {
      fetchFileContentById.mockResolvedValue({
        text: () => Promise.resolve('not json')
      })
      const file = { _id: 'f1', name: 'd.excalidraw' }

      const { result } = renderHook(() => useSceneSync(file))

      await waitFor(() => expect(result.current.status).toBe('loaded'))
      expect(result.current.scene.elements).toEqual([])
    })

    it('reads from the shared-drive scope when the file has a driveId', async () => {
      const file = { _id: 'f1', name: 'd.excalidraw', driveId: 'drive9' }

      const { result } = renderHook(() => useSceneSync(file))

      await waitFor(() => expect(result.current.status).toBe('loaded'))
      expect(collection).toHaveBeenCalledWith('io.cozy.files', {
        driveId: 'drive9'
      })
    })

    it('reads from the unscoped collection when the file has no driveId', async () => {
      const file = { _id: 'f1', name: 'd.excalidraw' }

      const { result } = renderHook(() => useSceneSync(file))

      await waitFor(() => expect(result.current.status).toBe('loaded'))
      expect(collection).toHaveBeenCalledWith('io.cozy.files', {})
    })
  })

  describe('autosave', () => {
    const file = { _id: 'f1', name: 'd.excalidraw' }

    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    })

    it('writes the scene to the binary on the interval after a real change', async () => {
      const { result } = renderHook(() =>
        useSceneSync(file, { intervalMs: 1000 })
      )
      await flushPromises() // let the binary load settle inside act

      act(() => result.current.onChange([], {}, {})) // baseline
      act(() => jest.advanceTimersByTime(1000))
      expect(updateFile).not.toHaveBeenCalled()

      act(() => result.current.onChange([{ id: 'a' }], { x: 1 }, {}))
      act(() => jest.advanceTimersByTime(1000))
      expect(updateFile).toHaveBeenCalledTimes(1)
      expect(updateFile).toHaveBeenCalledWith(
        JSON.stringify({
          elements: [{ id: 'a' }],
          appState: { x: 1 },
          files: {}
        }),
        {
          fileId: 'f1',
          name: 'd.excalidraw',
          contentType: 'application/vnd.excalidraw+json'
        }
      )
    })

    // Each case sets a baseline onChange, then a single change, and checks
    // whether the interval autosave persisted it.
    it.each([
      {
        desc: 'ignores onChange when only transient appState changes',
        options: { intervalMs: 1000 },
        change: [[], { selectedElementIds: { a: 1 } }, {}],
        expectedCalls: 0
      },
      {
        desc: 'saves when a persisted appState field changes but elements do not',
        options: { intervalMs: 1000 },
        change: [[], { viewBackgroundColor: '#fff' }, {}],
        expectedCalls: 1
      },
      {
        desc: 'saves when an embedded image is added',
        options: { intervalMs: 1000 },
        change: [[], {}, { img1: { dataURL: 'x' } }],
        expectedCalls: 1
      },
      {
        desc: 'does not write anything when read-only',
        options: { intervalMs: 1000, readOnly: true },
        change: [[{ id: 'a' }], {}, {}],
        expectedCalls: 0
      }
    ])('$desc', async ({ options, change, expectedCalls }) => {
      const { result } = renderHook(() => useSceneSync(file, options))
      await flushPromises()

      act(() => result.current.onChange([], {}, {})) // baseline
      act(() => result.current.onChange(...change))
      act(() => jest.advanceTimersByTime(1000))
      expect(updateFile).toHaveBeenCalledTimes(expectedCalls)
    })

    it('keeps the change dirty and retries when a save fails', async () => {
      updateFile
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(undefined)
      const { result } = renderHook(() =>
        useSceneSync(file, { intervalMs: 1000 })
      )

      act(() => result.current.onChange([], {}, {})) // baseline
      act(() => result.current.onChange([{ id: 'a' }], {}, {})) // change

      act(() => jest.advanceTimersByTime(1000))
      await flushPromises()
      expect(updateFile).toHaveBeenCalledTimes(1)

      act(() => jest.advanceTimersByTime(1000))
      await flushPromises()
      expect(updateFile).toHaveBeenCalledTimes(2)
    })

    it('flushes pending changes on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useSceneSync(file, { intervalMs: 100000 })
      )

      act(() => result.current.onChange([], {}, {})) // baseline
      act(() => result.current.onChange([{ id: 'a' }], {}, {})) // change

      unmount()
      await flushPromises()
      expect(updateFile).toHaveBeenCalledTimes(1)
    })
  })
})
