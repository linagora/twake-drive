import CozyClient from 'cozy-client'

import { CozyFile } from '@/models'
import {
  cancelMove,
  computeNextcloudMoveDirections,
  hasOneOfEntriesShared
} from '@/modules/move/helpers'

jest.mock('cozy-doctypes')
jest.mock('cozy-stack-client')

CozyFile.doctype = 'io.cozy.files'

const getSpy = jest.fn().mockResolvedValue({
  data: { id: 'fakeDoc', _type: 'io.cozy.files' }
})
const refreshSpy = jest.fn()
const restoreSpy = jest.fn()
const collectionSpy = jest.fn(() => ({
  get: getSpy,
  restore: restoreSpy
}))
const mockClient = new CozyClient({
  stackClient: {
    collection: collectionSpy,
    on: jest.fn()
  }
})
const t = x => x
const showAlert = jest.fn()

describe('cancelMove', () => {
  const defaultEntries = [
    {
      _id: 'bill_201901',
      dir_id: 'bills',
      name: 'bill_201901.pdf'
    },
    {
      _id: 'bill_201902',
      dir_id: 'bills',
      name: 'bill_201902.pdf'
    },
    // shared file:
    {
      _id: 'bill_201903',
      dir_id: 'bills',
      name: 'bill_201903.pdf'
    }
  ]
  const setup = async ({
    entries = defaultEntries,
    trashedFiles = []
  } = {}) => {
    return cancelMove({
      client: mockClient,
      entries: entries,
      trashedFiles: trashedFiles,
      showAlert,
      t,
      registerCancelable: promise => promise,
      refreshSharing: refreshSpy
    })
  }

  it('should move items back to their previous location', async () => {
    await setup()

    expect(CozyFile.move).toHaveBeenCalledWith('bill_201901', {
      folderId: 'bills'
    })
    expect(CozyFile.move).toHaveBeenCalledWith('bill_201902', {
      folderId: 'bills'
    })
    expect(restoreSpy).not.toHaveBeenCalled()
    expect(refreshSpy).toHaveBeenCalled()
  })

  it('should restore files that have been trashed due to conflicts', async () => {
    await setup({
      entries: [],
      trashedFiles: ['trashed-1', 'trashed-2']
    })

    expect(collectionSpy).toHaveBeenCalledWith('io.cozy.files', {})
    expect(restoreSpy).toHaveBeenCalledWith('trashed-1')
    expect(restoreSpy).toHaveBeenCalledWith('trashed-2')
    expect(refreshSpy).toHaveBeenCalled()
  })
})

describe('computeNextcloudMoveDirections', () => {
  const nextcloudEntry = { _type: 'io.cozy.remote.nextcloud.files' }
  const cozyEntry = { _type: 'io.cozy.files' }

  it.each([
    [nextcloudEntry, cozyEntry, true, false],
    [cozyEntry, nextcloudEntry, false, true],
    [cozyEntry, cozyEntry, false, false]
  ])(
    'computes the Nextcloud move directions',
    (
      folder,
      sourceEntry,
      isMovingInsideNextcloud,
      isMovingOutsideNextcloud
    ) => {
      expect(computeNextcloudMoveDirections(folder, sourceEntry)).toEqual({
        isMovingInsideNextcloud,
        isMovingOutsideNextcloud
      })
    }
  )
})

describe('hasOneOfEntriesShared', () => {
  it('should return false if entries are not shared', () => {
    const entries = [{ _id: '1' }, { _id: '2' }, { _id: '3' }]
    const byDocId = {}
    expect(hasOneOfEntriesShared(entries, byDocId)).toBe(false)
  })

  it('should return false if all entries are only shared by link', () => {
    const entries = [{ _id: '1' }, { _id: '2' }, { _id: '3' }]
    const byDocId = {
      1: { permissions: ['permission1'], sharings: [] },
      2: { permissions: ['permission2'], sharings: [] }
    }
    expect(hasOneOfEntriesShared(entries, byDocId)).toBe(false)
  })

  it('should return true if at least one entry is shared', () => {
    const entries = [{ _id: '1' }, { _id: '2' }, { _id: '3' }]
    const byDocId = {
      2: { permissions: [], sharings: ['sharingId'] }
    }
    expect(hasOneOfEntriesShared(entries, byDocId)).toBe(true)
  })
})
