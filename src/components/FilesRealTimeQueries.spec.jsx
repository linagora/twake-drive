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

  const setupDriveSocketsWithStop = driveIds => {
    const mockStop = jest.fn()
    CozyRealtime.mockImplementation(() => ({
      subscribe: jest.fn(),
      stop: mockStop
    }))
    useSharedDrives.mockReturnValue({
      isLoading: false,
      isLoaded: true,
      sharedDrives: driveIds.map(id => ({ _id: id, owner: false })),
      recipientDriveIds: driveIds
    })
    const { unmount } = setup()
    return { unmount, mockStop }
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

  describe('shared-drive sockets', () => {
    it('opens a CozyRealtime socket for each recipient drive (owner === false)', () => {
      useSharedDrives.mockReturnValue({
        isLoading: false,
        isLoaded: true,
        sharedDrives: [{ _id: 'd1', owner: false }],
        recipientDriveIds: ['d1']
      })

      setup()

      expect(CozyRealtime).toHaveBeenCalledWith({
        client,
        sharedDriveId: 'd1'
      })
    })

    it('opens one socket per recipient drive when multiple exist', () => {
      useSharedDrives.mockReturnValue({
        isLoading: false,
        isLoaded: true,
        sharedDrives: [
          { _id: 'd1', owner: false },
          { _id: 'd2', owner: false }
        ],
        recipientDriveIds: ['d1', 'd2']
      })

      setup()

      expect(CozyRealtime).toHaveBeenCalledTimes(2)
      expect(CozyRealtime).toHaveBeenCalledWith({
        client,
        sharedDriveId: 'd1'
      })
      expect(CozyRealtime).toHaveBeenCalledWith({
        client,
        sharedDriveId: 'd2'
      })
    })

    it('does not open a socket for owned drives (owner === true)', () => {
      useSharedDrives.mockReturnValue({
        isLoading: false,
        isLoaded: true,
        sharedDrives: [{ _id: 'd2', owner: true }],
        recipientDriveIds: []
      })

      setup()

      expect(CozyRealtime).not.toHaveBeenCalled()
    })

    it('dispatches drive-file events into the store with _type io.cozy.files', async () => {
      let capturedUpdatedCallback
      CozyRealtime.mockImplementation(() => ({
        subscribe: jest.fn((event, _doctype, callback) => {
          if (event === 'updated') capturedUpdatedCallback = callback
        }),
        stop: jest.fn()
      }))

      useSharedDrives.mockReturnValue({
        isLoading: false,
        isLoaded: true,
        sharedDrives: [{ _id: 'd1', owner: false }],
        recipientDriveIds: ['d1']
      })

      setup()

      expect(capturedUpdatedCallback).toBeDefined()

      const driveFileDoc = {
        _id: 'drive-file-1',
        name: 'shared-doc.txt',
        dir_id: PARENT_FOLDER._id,
        type: 'file'
      }

      act(() => {
        capturedUpdatedCallback(driveFileDoc)
      })

      await waitFor(() => expect(client.dispatch).toHaveBeenCalled())

      const action = client.dispatch.mock.calls[0][0]
      expect(action.response.data[0]._type).toBe('io.cozy.files')
      expect(action.response.data[0]._id).toBe('drive-file-1')
      // Path must be resolved via the local-pouch fetchQueryAndGetFromState (parent.path + '/' + name)
      expect(action.response.data[0].path).toBe(
        `${PARENT_FOLDER.path}/shared-doc.txt`
      )
    })

    it('subscribes to created, updated, and deleted events on the drive socket', () => {
      const mockSubscribe = jest.fn()
      CozyRealtime.mockImplementation(() => ({
        subscribe: mockSubscribe,
        stop: jest.fn()
      }))

      useSharedDrives.mockReturnValue({
        isLoading: false,
        isLoaded: true,
        sharedDrives: [{ _id: 'd1', owner: false }],
        recipientDriveIds: ['d1']
      })

      setup()

      expectThreeEvents(mockSubscribe)
    })

    it('calls stop() on each drive socket when the component unmounts', () => {
      const { unmount, mockStop } = setupDriveSocketsWithStop(['d1'])
      unmount()
      expect(mockStop).toHaveBeenCalledTimes(1)
    })

    it('calls stop() on all drive sockets when the component unmounts', () => {
      const { unmount, mockStop } = setupDriveSocketsWithStop(['d1', 'd2'])
      unmount()
      expect(mockStop).toHaveBeenCalledTimes(2)
    })

    it('stops the d1 socket and opens a d2 socket when the recipient-drive list changes mid-lifecycle', () => {
      const instances = []
      CozyRealtime.mockImplementation(({ sharedDriveId }) => {
        const inst = {
          subscribe: jest.fn(),
          stop: jest.fn(),
          _driveId: sharedDriveId
        }
        instances.push(inst)
        return inst
      })

      useSharedDrives.mockReturnValue({
        isLoading: false,
        isLoaded: true,
        sharedDrives: [{ _id: 'd1', owner: false }],
        recipientDriveIds: ['d1']
      })

      const { rerender } = setup()

      expect(CozyRealtime).toHaveBeenCalledTimes(1)
      expect(CozyRealtime).toHaveBeenCalledWith({ client, sharedDriveId: 'd1' })

      // Replace the drive list with d2 only — the effect deps change
      useSharedDrives.mockReturnValue({
        isLoading: false,
        isLoaded: true,
        sharedDrives: [{ _id: 'd2', owner: false }],
        recipientDriveIds: ['d2']
      })

      rerender(
        <AppLike client={client}>
          <FilesRealTimeQueries />
        </AppLike>
      )

      // The d1 socket must have been stopped by the effect cleanup
      expect(instances[0]._driveId).toBe('d1')
      expect(instances[0].stop).toHaveBeenCalledTimes(1)

      // CozyRealtime was constructed exactly twice (once for d1, once for d2)
      expect(CozyRealtime).toHaveBeenCalledTimes(2)
      expect(CozyRealtime).toHaveBeenNthCalledWith(2, {
        client,
        sharedDriveId: 'd2'
      })
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

      let capturedCreatedCallback
      CozyRealtime.mockImplementation(() => ({
        subscribe: jest.fn((event, _doctype, callback) => {
          if (event === 'created') capturedCreatedCallback = callback
        }),
        stop: jest.fn()
      }))

      setup(driveClient)

      expect(capturedCreatedCallback).toBeDefined()

      const driveFileDoc = {
        _id: 'drive-file-new',
        name: 'new-doc.txt',
        dir_id: driveParentFolder._id,
        type: 'file'
      }

      act(() => {
        capturedCreatedCallback(driveFileDoc)
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
