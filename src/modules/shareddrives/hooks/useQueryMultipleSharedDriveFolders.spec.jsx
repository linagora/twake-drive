import { act, renderHook } from '@testing-library/react'

import { useClient } from 'cozy-client'

import { useQueryMultipleSharedDriveFolders } from './useQueryMultipleSharedDriveFolders'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn()
}))

describe('useQueryMultipleSharedDriveFolders', () => {
  it('keeps results unavailable until the folders have loaded', async () => {
    const file = { _id: 'file-1', name: 'File 1.pdf' }
    const folderIds = ['file-1']
    let resolveQuery
    useClient.mockReturnValue({
      query: jest.fn(
        () =>
          new Promise(resolve => {
            resolveQuery = resolve
          })
      )
    })

    const { result } = renderHook(() =>
      useQueryMultipleSharedDriveFolders({
        driveId: 'drive-1',
        folderIds
      })
    )

    expect(result.current.sharedDriveResults).toBe(null)

    await act(async () => {
      resolveQuery({ data: file })
    })

    expect(result.current.sharedDriveResults).toEqual([file])
  })

  it('clears results and ignores responses from superseded queries', async () => {
    const firstFile = { _id: 'file-1', name: 'File 1.pdf' }
    const secondFile = { _id: 'file-2', name: 'File 2.pdf' }
    const thirdFile = { _id: 'file-3', name: 'File 3.pdf' }
    const resolveQueries = []
    useClient.mockReturnValue({
      query: jest.fn(
        () =>
          new Promise(resolve => {
            resolveQueries.push(resolve)
          })
      )
    })

    const { result, rerender } = renderHook(
      ({ folderIds }) =>
        useQueryMultipleSharedDriveFolders({
          driveId: 'drive-1',
          folderIds
        }),
      { initialProps: { folderIds: ['file-1'] } }
    )

    await act(async () => {
      resolveQueries[0]({ data: firstFile })
    })
    expect(result.current.sharedDriveResults).toEqual([firstFile])

    rerender({ folderIds: ['file-2'] })
    expect(result.current.sharedDriveResults).toBe(null)

    rerender({ folderIds: ['file-3'] })
    await act(async () => {
      resolveQueries[2]({ data: thirdFile })
    })
    expect(result.current.sharedDriveResults).toEqual([thirdFile])

    await act(async () => {
      resolveQueries[1]({ data: secondFile })
    })
    expect(result.current.sharedDriveResults).toEqual([thirdFile])
  })
})
