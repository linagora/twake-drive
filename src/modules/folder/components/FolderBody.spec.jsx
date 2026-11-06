import { render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import { FolderBody } from './FolderBody'
import AppLike from 'test/components/AppLike'

jest.mock('@/components/Error/Empty', () => ({
  EmptyDrive: ({ driveId }) => (
    <span data-testid="empty-drive" data-drive-id={driveId} />
  )
}))
jest.mock('@/hooks', () => ({
  useFolderSort: () => [null, jest.fn(), true]
}))
jest.mock('@/modules/selection/SelectionBar', () => () => null)

describe('FolderBody', () => {
  it('gives the default empty state the shared drive of the folder', () => {
    render(
      <AppLike client={createMockClient({})}>
        <FolderBody
          folderId="folder-id"
          driveId="drive-id"
          queryResults={[{ fetchStatus: 'loaded', data: [], lastUpdate: 1 }]}
        />
      </AppLike>
    )

    expect(screen.getByTestId('empty-drive')).toHaveAttribute(
      'data-drive-id',
      'drive-id'
    )
  })
})
