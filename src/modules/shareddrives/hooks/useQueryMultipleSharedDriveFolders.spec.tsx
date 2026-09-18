import { renderHook } from '@testing-library/react'
import React, { ReactElement, ReactNode } from 'react'

import { createMockClient } from 'cozy-client'

import { useQueryMultipleSharedDriveFolders } from './useQueryMultipleSharedDriveFolders'
import AppLike from 'test/components/AppLike'

interface WrapperProps {
  children: ReactNode
}

describe('useQueryMultipleSharedDriveFolders', () => {
  it('keeps results pending while shared drive files are loading', () => {
    const client = createMockClient({})
    client.query = jest.fn(() => new Promise(() => null))
    const wrapper = ({ children }: WrapperProps): ReactElement => (
      <AppLike client={client}>{children}</AppLike>
    )

    const { result } = renderHook(
      () =>
        useQueryMultipleSharedDriveFolders({
          driveId: 'source-drive',
          folderIds: ['source-file']
        }),
      { wrapper }
    )

    expect(result.current.sharedDriveResults).toBeNull()
  })
})
