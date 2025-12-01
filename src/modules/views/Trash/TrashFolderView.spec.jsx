import { render } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppLike from 'test/components/AppLike'

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(() => null)
}))

import { useCurrentFolderId, useFolderSort } from '@/hooks'

jest.mock('@/hooks', () => ({
  useCurrentFolderId: jest.fn(() => 'io.cozy.files.trash-dir'),
  useDisplayedFolder: jest.fn(() => ({
    displayedFolder: { _id: 'trash' },
    isNotFound: false
  })),
  useFolderSort: jest.fn(() => [
    { attribute: 'updated_at', order: 'desc' },
    jest.fn()
  ])
}))

const client = createMockClient({})
client.query = jest.fn().mockReturnValue({ data: [] })

function TestComponent({ onResult }) {
  const currentFolderId = useCurrentFolderId()
  const [sortOrder] = useFolderSort(currentFolderId)

  React.useEffect(() => {
    onResult({ currentFolderId, sortOrder })
  }, [currentFolderId, sortOrder, onResult])

  return null
}

describe('TrashFolderView', () => {
  it('uses the updated_at sort for trash folder by default', () => {
    let result = null

    const handleResult = data => {
      result = data
    }

    render(
      <AppLike client={client}>
        <TestComponent onResult={handleResult} />
      </AppLike>
    )

    expect(result.currentFolderId).toBe('io.cozy.files.trash-dir')
    expect(result.sortOrder.attribute).toBe('updated_at')
    expect(result.sortOrder.order).toBe('desc')
  })
})
