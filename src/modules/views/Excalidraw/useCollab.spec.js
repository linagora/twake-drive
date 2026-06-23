import { renderHook, act } from '@testing-library/react'

import { useClient } from 'cozy-client'

import { useCollab } from './useCollab'

jest.mock('cozy-client', () => ({
  useClient: jest.fn()
}))
jest.mock('@/lib/logger', () => ({ warn: jest.fn(), error: jest.fn() }))
jest.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { NEVER: 'NEVER' },
  getSceneVersion: elements => elements.length,
  reconcileElements: (local, remote) => remote,
  restoreElements: elements => elements
}))

const DOCTYPE = 'io.cozy.files'
const file = { _id: 'file-1', name: 'd.excalidraw' }

// Drives the realtime handler the hook registered, as if a peer message arrived.
const receive = (realtime, message) =>
  act(() => realtime.handler({ data: message }))

// Puts a peer in the room so scene/cursor broadcasts are no longer suppressed.
const joinPeer = (realtime, senderId = 'peer-2') =>
  receive(realtime, { senderId, type: 'PRESENCE_PING' })

// The session id is random per mount; read it back from the HELLO the hook sends.
const sessionIdOf = realtime =>
  realtime.sendNotification.mock.calls[0][2].senderId

const setup = ({ enabled = true, isReadOnly = false, withApi = true } = {}) => {
  const realtime = {
    subscribe: jest.fn((event, doctype, id, handler) => {
      realtime.handler = handler
    }),
    unsubscribe: jest.fn(),
    sendNotification: jest.fn().mockResolvedValue(undefined),
    handler: null
  }
  // Stateful enough to tell deleted from non-deleted elements, so the version
  // watermark (taken over all elements) and getSceneElements() (non-deleted)
  // can legitimately diverge once a shape is deleted.
  let applied = []
  const api = {
    getSceneElements: jest.fn(() => applied.filter(el => !el.isDeleted)),
    getSceneElementsIncludingDeleted: jest.fn(() => applied),
    getAppState: jest.fn(() => ({})),
    getFiles: jest.fn(() => ({})),
    addFiles: jest.fn(),
    updateScene: jest.fn(scene => {
      if (scene.elements) applied = scene.elements
    })
  }
  useClient.mockReturnValue({ plugins: { realtime } })

  const utils = renderHook(() =>
    useCollab({
      file,
      excalidrawAPI: withApi ? api : null,
      isReadOnly,
      enabled,
      username: 'Alice'
    })
  )
  return { realtime, api, ...utils }
}

describe('useCollab', () => {
  beforeEach(() => jest.clearAllMocks())

  it('subscribes to the events doctype and announces itself on mount', () => {
    const { realtime } = setup()

    expect(realtime.subscribe).toHaveBeenCalledWith(
      'notified',
      DOCTYPE,
      'file-1',
      expect.any(Function)
    )
    expect(realtime.sendNotification).toHaveBeenCalledWith(
      DOCTYPE,
      'file-1',
      expect.objectContaining({ type: 'PRESENCE_HELLO', username: 'Alice' })
    )
  })

  it('does not subscribe when collaboration is disabled', () => {
    const { realtime } = setup({ enabled: false })
    expect(realtime.subscribe).not.toHaveBeenCalled()
  })

  it('does not subscribe before the Excalidraw API is ready', () => {
    const { realtime } = setup({ withApi: false })
    expect(realtime.subscribe).not.toHaveBeenCalled()
  })

  it('ignores its own echoed messages', () => {
    const { realtime, api } = setup()
    const myId = sessionIdOf(realtime)

    receive(realtime, {
      senderId: myId,
      type: 'SCENE_UPDATE',
      payload: { elements: [{ id: 'x' }] }
    })

    expect(api.updateScene).not.toHaveBeenCalled()
  })

  it('reconciles and renders a remote scene update', () => {
    const { realtime, api } = setup()

    receive(realtime, {
      senderId: 'peer-2',
      type: 'SCENE_UPDATE',
      payload: { elements: [{ id: 'x' }] }
    })

    expect(api.updateScene).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [{ id: 'x' }],
        captureUpdate: 'NEVER'
      })
    )
  })

  it('only applies a SCENE_INIT addressed to this session', () => {
    const { realtime, api } = setup()
    const myId = sessionIdOf(realtime)

    receive(realtime, {
      senderId: 'peer-2',
      type: 'SCENE_INIT',
      targetId: 'someone-else',
      payload: { elements: [{ id: 'x' }] }
    })
    // Presence still updates (collaborators), but the scene is not applied.
    expect(api.updateScene).not.toHaveBeenCalledWith(
      expect.objectContaining({ elements: expect.anything() })
    )

    receive(realtime, {
      senderId: 'peer-2',
      type: 'SCENE_INIT',
      targetId: myId,
      payload: { elements: [{ id: 'x' }] }
    })
    expect(api.updateScene).toHaveBeenCalledWith(
      expect.objectContaining({ elements: [{ id: 'x' }] })
    )
  })

  it('answers a newcomer HELLO with a targeted SCENE_INIT', () => {
    const { realtime } = setup()

    receive(realtime, { senderId: 'newcomer', type: 'PRESENCE_HELLO' })

    expect(realtime.sendNotification).toHaveBeenCalledWith(
      DOCTYPE,
      'file-1',
      expect.objectContaining({ type: 'SCENE_INIT', targetId: 'newcomer' })
    )
  })

  // The first onChange is the loaded-scene baseline and never broadcasts; a real
  // edit is the next onChange with a strictly higher version.
  const baseline = result => act(() => result.current.broadcastScene([]))

  it('baselines the first onChange without broadcasting', () => {
    const { realtime, result } = setup()
    joinPeer(realtime)
    realtime.sendNotification.mockClear()

    act(() => result.current.broadcastScene([{ id: 'a' }]))

    expect(realtime.sendNotification).not.toHaveBeenCalled()
  })

  it('broadcasts a local edit once it raises the scene version', () => {
    const { realtime, result } = setup()
    baseline(result)
    joinPeer(realtime)
    realtime.sendNotification.mockClear()

    act(() => result.current.broadcastScene([{ id: 'a' }]))

    expect(realtime.sendNotification).toHaveBeenCalledWith(
      DOCTYPE,
      'file-1',
      expect.objectContaining({
        type: 'SCENE_UPDATE',
        payload: { elements: [{ id: 'a' }] }
      })
    )
  })

  it('broadcasts edits with no detected peer, so invisible read-only viewers stay in sync', () => {
    // A read-only viewer (read share, public link) has no POST on /realtime, so
    // it never announces itself and is invisible to presence. Gating on detected
    // peers would freeze its canvas, so editors broadcast unconditionally.
    const { realtime, result } = setup()
    baseline(result)
    realtime.sendNotification.mockClear()

    act(() => result.current.broadcastScene([{ id: 'a' }]))

    expect(realtime.sendNotification).toHaveBeenCalledWith(
      DOCTYPE,
      'file-1',
      expect.objectContaining({
        type: 'SCENE_UPDATE',
        payload: { elements: [{ id: 'a' }] }
      })
    )
  })

  it('does not throw when sendNotification returns no promise', () => {
    // RealtimePlugin.sendNotification returns undefined, so chaining .catch on
    // its result would crash the editor on the first edit.
    const { realtime, result } = setup()
    realtime.sendNotification.mockReturnValue(undefined)
    baseline(result)
    joinPeer(realtime)

    expect(() =>
      act(() => result.current.broadcastScene([{ id: 'a' }]))
    ).not.toThrow()
  })

  it('does not POST anything when collaboration is disabled', () => {
    const { realtime, result } = setup({ enabled: false })
    baseline(result)

    act(() => result.current.broadcastScene([{ id: 'a' }]))

    expect(realtime.sendNotification).not.toHaveBeenCalled()
  })

  it('does not rebroadcast when the scene version is unchanged', () => {
    const { realtime, result } = setup()
    baseline(result)
    joinPeer(realtime)
    act(() => result.current.broadcastScene([{ id: 'a' }])) // version 1 → sent
    realtime.sendNotification.mockClear()

    // same version (one element) → echo of our own update, must not resend
    act(() => result.current.broadcastScene([{ id: 'b' }]))

    expect(realtime.sendNotification).not.toHaveBeenCalled()
  })

  it('does not rebroadcast a remote update that deleted an element', () => {
    // Deleting keeps a tombstone, so onChange (which includes deleted elements)
    // reports a higher version than the non-deleted set. The watermark must be
    // taken over all elements, or every applied update floods back forever.
    const { realtime, result } = setup()
    baseline(result)
    joinPeer(realtime)

    receive(realtime, {
      senderId: 'peer-2',
      type: 'SCENE_UPDATE',
      payload: { elements: [{ id: 'a' }, { id: 'b', isDeleted: true }] }
    })
    realtime.sendNotification.mockClear()

    // The canvas echoes the merged scene back through onChange, tombstone and
    // all; this is our own applied update and must not be rebroadcast.
    act(() =>
      result.current.broadcastScene([{ id: 'a' }, { id: 'b', isDeleted: true }])
    )

    expect(realtime.sendNotification).not.toHaveBeenCalled()
  })

  it('never broadcasts scene edits for a read-only viewer', () => {
    const { realtime, result } = setup({ isReadOnly: true })
    baseline(result)
    joinPeer(realtime)
    realtime.sendNotification.mockClear()

    act(() => result.current.broadcastScene([{ id: 'a' }]))

    expect(realtime.sendNotification).not.toHaveBeenCalled()
  })

  it('subscribes to receive but never POSTs as a read-only viewer', () => {
    // A read share / public read link has GET (subscribe) but no POST, so it
    // must receive without ever hitting the realtime endpoint.
    const { realtime } = setup({ isReadOnly: true })

    expect(realtime.subscribe).toHaveBeenCalledWith(
      'notified',
      DOCTYPE,
      'file-1',
      expect.any(Function)
    )
    expect(realtime.sendNotification).not.toHaveBeenCalled()
  })

  it('says goodbye and unsubscribes on unmount', () => {
    const { realtime, unmount } = setup()

    unmount()

    expect(realtime.sendNotification).toHaveBeenCalledWith(
      DOCTYPE,
      'file-1',
      expect.objectContaining({ type: 'PRESENCE_BYE' })
    )
    expect(realtime.unsubscribe).toHaveBeenCalledWith(
      'notified',
      DOCTYPE,
      'file-1',
      expect.any(Function)
    )
  })
})
