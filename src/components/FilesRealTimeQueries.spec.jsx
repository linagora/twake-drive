import { render, act, waitFor } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import CozyRealtime from 'cozy-realtime'

import FilesRealTimeQueries, {
  __resetDriveIdByFileId
} from './FilesRealTimeQueries'
import AppLike from 'test/components/AppLike'

import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'

jest.mock('cozy-realtime', () =>
  jest.fn().mockImplementation(() => ({
    subscribe: jest.fn(),
    stop: jest.fn()
  }))
)

jest.mock('lodash/debounce', () =>
  jest.fn(fn => {
    const immediate = (...args) => fn(...args)
    immediate.cancel = jest.fn()
    return immediate
  })
)

jest.mock('@/modules/shareddrives/hooks/useSharedDrives', () => ({
  useSharedDrives: jest.fn()
}))

const PARENT_FOLDER = {
  _id: 'folder-parent',
  _type: 'io.cozy.files',
  type: 'directory',
  path: '/My Files',
  name: 'My Files',
  dir_id: ''
}

const buildMockClient = () => {
  const client = createMockClient({})
  client.dispatch = jest.fn()
  client.getDocumentFromState = jest.fn().mockReturnValue(null)
  client.generateRandomId = jest.fn().mockReturnValue('mock-id')
  client.fetchQueryAndGetFromState = jest
    .fn()
    .mockResolvedValue({ data: PARENT_FOLDER })
  client.collection = jest.fn().mockReturnValue({
    statById: jest.fn().mockResolvedValue({ data: PARENT_FOLDER })
  })

  client.plugins = {
    realtime: {
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    }
  }

  return client
}

describe('FilesRealTimeQueries', () => {
  let client

  beforeEach(() => {
    jest.clearAllMocks()
    __resetDriveIdByFileId()
    client = buildMockClient()

    // Default: no shared drives
    useSharedDrives.mockReturnValue({
      isLoading: false,
      isLoaded: true,
      sharedDrives: [],
      recipientDriveIds: []
    })
  })

  const setup = (overrideClient = client) => {
    return render(
      <AppLike client={overrideClient}>
        <FilesRealTimeQueries />
      </AppLike>
    )
  }

  const expectThreeEvents = mockFn => {
    for (const event of ['created', 'updated', 'deleted']) {
      expect(mockFn).toHaveBeenCalledWith(
        event,
        'io.cozy.files',
        expect.any(Function)
      )
    }
  }

  // ── Task 3.1: subscribe shared-drive sockets ────────────────────────────────

  describe('global plugin subscription (no regression)', () => {
    it('subscribes to created, updated, and deleted events via the global plugin', async () => {
      setup()
      // subscribeToEvents() is async; flush microtasks to let it complete
      await act(async () => {})

      expectThreeEvents(client.plugins.realtime.subscribe)
    })

    it('dispatches own-file events into the store with _type io.cozy.files', async () => {
      setup()
      await act(async () => {})

      // Capture the handler registered for the 'updated' event
      const subscribeCalls = client.plugins.realtime.subscribe.mock.calls
      const updatedCall = subscribeCalls.find(([event]) => event === 'updated')
      expect(updatedCall).toBeDefined()
      const handler = updatedCall[2]

      const ownFileDoc = {
        _id: 'own-file-1',
        name: 'report.pdf',
        dir_id: PARENT_FOLDER._id,
        type: 'file'
      }

      act(() => {
        handler(ownFileDoc)
      })

      await waitFor(() => expect(client.dispatch).toHaveBeenCalled())

      const action = client.dispatch.mock.calls[0][0]
      expect(action.response.data[0]._type).toBe('io.cozy.files')
      expect(action.response.data[0]._id).toBe('own-file-1')
    })

    it('unsubscribes from global plugin events on unmount', async () => {
      const { unmount } = setup()
      await act(async () => {})

      unmount()

      expectThreeEvents(client.plugins.realtime.unsubscribe)
    })
  })

  describe('data-proxy realtime push (replaces per-drive websockets)', () => {
    it('does not open per-drive websockets anymore', () => {
      // Deliberately proves the negative: even with shared drives present,
      // the component must not fall back to per-drive CozyRealtime sockets.
      useSharedDrives.mockReturnValue({ recipientDriveIds: ['d1', 'd2'] })
      setup()
      expect(CozyRealtime).not.toHaveBeenCalled()
    })

    it('dispatches a store mutation when the data-proxy pushes a realtime update', async () => {
      const driveClient = buildMockClient()
      driveClient.fetchQueryAndGetFromState = jest
        .fn()
        .mockResolvedValue({ data: PARENT_FOLDER })

      setup(driveClient)

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'http://dataproxy.cozy.localhost:8080',
            data: {
              type: 'DATAPROXYMESSAGE',
              payload: {
                kind: 'realtime',
                event: 'updated',
                doctype: 'io.cozy.files',
                driveId: 'd1',
                doc: { _id: 'file-1', name: 'renamed.txt', dir_id: 'folder-1' }
              }
            }
          })
        )
      })

      await waitFor(() => expect(driveClient.dispatch).toHaveBeenCalled())
      expect(driveClient.fetchQueryAndGetFromState).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            driveId: 'd1',
            forceLink: 'dataproxy'
          })
        })
      )
    })

    it('ignores messages from a non data-proxy origin', async () => {
      const driveClient = buildMockClient()
      setup(driveClient)

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'http://evil.example.com',
            data: {
              type: 'DATAPROXYMESSAGE',
              payload: {
                kind: 'realtime',
                event: 'updated',
                doctype: 'io.cozy.files',
                driveId: 'd1',
                doc: { _id: 'x' }
              }
            }
          })
        )
      })

      expect(driveClient.dispatch).not.toHaveBeenCalled()
    })

    it('ignores messages with the right payload but a wrong/absent envelope type', async () => {
      const driveClient = buildMockClient()
      setup(driveClient)

      const validPayload = {
        kind: 'realtime',
        event: 'updated',
        doctype: 'io.cozy.files',
        driveId: 'd1',
        doc: { _id: 'file-envelope', name: 'x.txt', dir_id: 'folder-1' }
      }

      await act(async () => {
        // Wrong type
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'http://dataproxy.cozy.localhost:8080',
            data: { type: 'SOMETHING_ELSE', payload: validPayload }
          })
        )
        // Absent type
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'http://dataproxy.cozy.localhost:8080',
            data: { payload: validPayload }
          })
        )
      })

      expect(driveClient.dispatch).not.toHaveBeenCalled()
    })

    it('dispatches a store mutation when the data-proxy pushes a realtime delete', async () => {
      const driveClient = buildMockClient()
      driveClient.fetchQueryAndGetFromState = jest
        .fn()
        .mockResolvedValue({ data: PARENT_FOLDER })

      setup(driveClient)

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'http://dataproxy.cozy.localhost:8080',
            data: {
              type: 'DATAPROXYMESSAGE',
              payload: {
                kind: 'realtime',
                event: 'deleted',
                doctype: 'io.cozy.files',
                driveId: 'd1',
                doc: {
                  _id: 'file-deleted-1',
                  name: 'gone.txt',
                  dir_id: 'io.cozy.files.trash-dir'
                }
              }
            }
          })
        )
      })

      await waitFor(() => expect(driveClient.dispatch).toHaveBeenCalled())

      const action = driveClient.dispatch.mock.calls[0][0]
      expect(action.response.data[0]._id).toBe('file-deleted-1')
      expect(action.definition).toBeDefined()
    })

    it('removes the window message listener on unmount', async () => {
      jest.spyOn(window, 'removeEventListener')

      const { unmount } = setup()
      await act(async () => {})

      unmount()

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })
  })

  // ── Task 3.2: drive-scoped path resolution ─────────────────────────────────

  describe('drive-scoped path resolution', () => {
    it('resolves parent folder via fetchQueryAndGetFromState (local pouch) for drive files', async () => {
      const driveParentFolder = {
        _id: 'drive-folder-parent',
        _type: 'io.cozy.files',
        type: 'directory',
        path: '/Shared Drive',
        name: 'Shared Drive',
        dir_id: ''
      }

      const driveClient = buildMockClient()
      driveClient.fetchQueryAndGetFromState = jest
        .fn()
        .mockResolvedValue({ data: driveParentFolder })

      useSharedDrives.mockReturnValue({
        isLoading: false,
        isLoaded: true,
        sharedDrives: [{ _id: 'd1', owner: false }],
        recipientDriveIds: ['d1']
      })

      setup(driveClient)

      const driveFileDoc = {
        _id: 'drive-file-new',
        name: 'new-doc.txt',
        dir_id: driveParentFolder._id,
        type: 'file'
      }

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'http://dataproxy.cozy.localhost:8080',
            data: {
              type: 'DATAPROXYMESSAGE',
              payload: {
                kind: 'realtime',
                event: 'created',
                doctype: 'io.cozy.files',
                driveId: 'd1',
                doc: driveFileDoc
              }
            }
          })
        )
      })

      await waitFor(() => expect(driveClient.dispatch).toHaveBeenCalled())

      const action = driveClient.dispatch.mock.calls[0][0]
      const dispatchedDoc = action.response.data[0]

      // The path must be resolved via the local-pouch fetchQueryAndGetFromState
      expect(dispatchedDoc.path).toBe('/Shared Drive/new-doc.txt')

      // Must use fetchQueryAndGetFromState with driveId and forceLink: 'dataproxy'
      expect(driveClient.fetchQueryAndGetFromState).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            driveId: 'd1',
            forceLink: 'dataproxy'
          })
        })
      )
      // The network drive-scoped collection (statById) must NOT have been used
      expect(driveClient.collection).not.toHaveBeenCalledWith('io.cozy.files', {
        driveId: 'd1'
      })
    })

    it('resolves parent folder via fetchQueryAndGetFromState for own files (no driveId)', async () => {
      setup()
      await act(async () => {})

      const subscribeCalls = client.plugins.realtime.subscribe.mock.calls
      const createdCall = subscribeCalls.find(([event]) => event === 'created')
      const handler = createdCall[2]

      const ownFileDoc = {
        _id: 'own-file-new',
        name: 'local-doc.txt',
        dir_id: PARENT_FOLDER._id,
        type: 'file'
      }

      act(() => {
        handler(ownFileDoc)
      })

      await waitFor(() => expect(client.dispatch).toHaveBeenCalled())

      const action = client.dispatch.mock.calls[0][0]
      const dispatchedDoc = action.response.data[0]

      // Path resolves correctly from the mock parent returned by fetchQueryAndGetFromState
      expect(dispatchedDoc.path).toBe('/My Files/local-doc.txt')
      // The non-drive path uses fetchQueryAndGetFromState, not drive-scoped collection
      expect(client.fetchQueryAndGetFromState).toHaveBeenCalled()
    })
  })
})
