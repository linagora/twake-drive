import { render, waitFor } from '@testing-library/react'
import React from 'react'

import OldFolderViewBreadcrumb from './OldFolderViewBreadcrumb'

import useDisplayedFolder from '@/hooks/useDisplayedFolder'

jest.mock('modules/breadcrumb/components/MobileAwareBreadcrumb', () => ({
  MobileAwareBreadcrumb: ({ path }) => (
    <div data-testid="MobileAwareBreadcrumb" data-path={JSON.stringify(path)} />
  )
}))
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn()
}))
jest.mock('cozy-client', () => ({
  useClient: jest.fn()
}))
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: jest.fn() }
}))
jest.mock('@/hooks/useDisplayedFolder', () => ({
  __esModule: true,
  default: jest.fn()
}))

const mockDisplayedFolder = ({ displayedFolder = null, isLoading = false }) =>
  useDisplayedFolder.mockReturnValue({ displayedFolder, isLoading })

describe('OldFolderViewBreadcrumb', () => {
  it('should render skeleton while the folder is loading', () => {
    // Given the folder query is still in flight
    mockDisplayedFolder({ displayedFolder: null, isLoading: true })

    const { getByTestId, queryByTestId } = render(
      <OldFolderViewBreadcrumb
        sharedDocumentId={null}
        getBreadcrumbPath={jest.fn()}
      />
    )

    // Then the skeleton reserves the space instead of rendering nothing
    expect(getByTestId('breadcrumb-skeleton')).toBeTruthy()
    expect(queryByTestId('MobileAwareBreadcrumb')).toBeNull()
  })

  it('should render nothing when the folder cannot be loaded (settled, not loading)', () => {
    // Given an inaccessible/trashed/revoked folder: the folder query has
    // settled without a result, so it is no longer loading and there is no
    // displayedFolder to build a breadcrumb from.
    mockDisplayedFolder({ displayedFolder: null, isLoading: false })

    const { container, queryByTestId } = render(
      <OldFolderViewBreadcrumb
        sharedDocumentId="shared"
        getBreadcrumbPath={jest.fn()}
      />
    )

    // Then we render nothing rather than a skeleton that spins forever
    expect(queryByTestId('breadcrumb-skeleton')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('should render the breadcrumb once the path resolves', async () => {
    // Given a resolved folder and a resolvable breadcrumb path
    mockDisplayedFolder({ displayedFolder: { id: 'a' }, isLoading: false })
    const path = [{ id: 'a', name: 'A' }]
    const getBreadcrumbPath = jest.fn().mockResolvedValue(path)

    // When
    const { findByTestId, queryByTestId } = render(
      <OldFolderViewBreadcrumb
        sharedDocumentId="shared"
        getBreadcrumbPath={getBreadcrumbPath}
      />
    )

    // Then the real breadcrumb replaces the skeleton, with the resolved path
    const breadcrumb = await findByTestId('MobileAwareBreadcrumb')
    expect(breadcrumb.getAttribute('data-path')).toEqual(JSON.stringify(path))
    expect(queryByTestId('breadcrumb-skeleton')).toBeNull()
  })

  it('does not refetch the breadcrumb path when only the folder object reference changes', async () => {
    // A store write gives a fresh displayedFolder object with the same identity;
    // the path must still be fetched only once.
    mockDisplayedFolder({
      displayedFolder: { id: 'a', name: 'A', dir_id: 'root' },
      isLoading: false
    })
    const getBreadcrumbPath = jest
      .fn()
      .mockResolvedValue([{ id: 'a', name: 'A' }])

    const { rerender, findByTestId } = render(
      <OldFolderViewBreadcrumb
        sharedDocumentId="shared"
        getBreadcrumbPath={getBreadcrumbPath}
      />
    )
    await findByTestId('MobileAwareBreadcrumb')
    expect(getBreadcrumbPath).toHaveBeenCalledTimes(1)

    mockDisplayedFolder({
      displayedFolder: { id: 'a', name: 'A', dir_id: 'root' },
      isLoading: false
    })
    rerender(
      <OldFolderViewBreadcrumb
        sharedDocumentId="shared"
        getBreadcrumbPath={getBreadcrumbPath}
      />
    )
    await Promise.resolve()
    expect(getBreadcrumbPath).toHaveBeenCalledTimes(1)
  })

  it('should render nothing once a breadcrumb fetch error settles', async () => {
    // Given a resolved folder but a path fetch that rejects
    mockDisplayedFolder({ displayedFolder: { id: 'a' }, isLoading: false })
    const getBreadcrumbPath = jest.fn().mockRejectedValue(new Error('boom'))

    // When
    const { container, queryByTestId } = render(
      <OldFolderViewBreadcrumb
        sharedDocumentId="shared"
        getBreadcrumbPath={getBreadcrumbPath}
      />
    )

    // Then the skeleton is dropped rather than left spinning forever
    await waitFor(() => expect(queryByTestId('breadcrumb-skeleton')).toBeNull())
    expect(queryByTestId('MobileAwareBreadcrumb')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
