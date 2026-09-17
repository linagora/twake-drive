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
        folderIds: ['file-1']
      })
    )

    expect(result.current.sharedDriveResults).toBe(null)

    await act(async () => {
      resolveQuery({ data: file })
    })

    expect(result.current.sharedDriveResults).toEqual([file])
  })
})
