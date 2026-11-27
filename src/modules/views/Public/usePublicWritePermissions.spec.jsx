import { renderHook, waitFor } from '@testing-library/react'

import { models } from 'cozy-client'

import { usePublicWritePermissions } from './usePublicWritePermissions'

const client = {}

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn(() => client)
}))

describe('usePublicWritePermissions', () => {
  it('reads the rights from the files rule, not from the apps rule', async () => {
    jest.spyOn(models.permission, 'fetchOwn').mockResolvedValue([
      {
        type: 'io.cozy.apps',
        verbs: ['GET'],
        selector: 'slug',
        values: ['notes']
      },
      { type: 'io.cozy.files', verbs: ['ALL'], values: ['folder-id'] }
    ])

    const { result } = renderHook(() => usePublicWritePermissions())

    await waitFor(() => expect(result.current.fetchStatus).toBe('loaded'))
    expect(result.current.hasWritePermissions).toBe(true)
  })
})
