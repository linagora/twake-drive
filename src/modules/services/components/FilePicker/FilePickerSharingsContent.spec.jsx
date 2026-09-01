import { render, screen } from '@testing-library/react'
import React from 'react'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'

import { FilePickerSharingsContent } from './FilePickerSharingsContent'

import { SHARING_TAB_WITH_ME } from '@/constants/config'
import { useFilteredSharings } from '@/modules/views/Sharings/useFilteredSharings'
import { getSharingsFetchStatus } from '@/modules/views/Sharings/useSharingsQueryResult'
import { buildSharingsQuery } from '@/queries'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))
jest.mock('cozy-client/dist/models/file', () => ({
  isSharingShortcutNew: item => item.metadata?.sharing?.status === 'new'
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('@/modules/views/Sharings/useFilteredSharings', () => ({
  useFilteredSharings: jest.fn()
}))
jest.mock('@/queries', () => ({ buildSharingsQuery: jest.fn() }))

const rootBreadcrumbPath = { id: 'sharings-root', name: 'Sharings' }

function renderFilePickerContent(source) {
  return (
    <div>
      <span data-testid="fetch-status">{source.fetchStatus}</span>
      <span data-testid="breadcrumb">{source.breadcrumbPath[0].name}</span>
      {source.items.map(item => (
        <button
          key={item._id}
          type="button"
          disabled={source.isItemDisabled(item)}
        >
          {item.name}
        </button>
      ))}
    </div>
  )
}

function setup({
  allLoaded = true,
  filteredResult = { data: [], fetchStatus: 'loaded', lastFetch: 1 },
  sharedDrivesLoaded = true,
  sharedDocumentIds = ['shared-id', 'duplicate']
} = {}) {
  useSharingContext.mockReturnValue({
    allLoaded,
    byDocId: { 'shared-id': {}, duplicate: {} }
  })
  const query = {
    definition: jest.fn(),
    options: { enabled: allLoaded }
  }
  buildSharingsQuery.mockReturnValue(query)
  const queryResult = { data: [], fetchStatus: 'loaded' }
  useQuery.mockReturnValue(queryResult)
  useFilteredSharings.mockReturnValue({
    filteredResult,
    sharedDrivesLoaded
  })

  return {
    query,
    ...render(
      <FilePickerSharingsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
        sharedDocumentIds={sharedDocumentIds}
        renderFilePickerContent={renderFilePickerContent}
      />
    )
  }
}

describe('FilePickerSharingsContent', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders the canonical With me result and disables pending invitations', () => {
    const { query } = setup({
      filteredResult: {
        fetchStatus: 'loaded',
        lastFetch: 1,
        data: [
          { _id: 'file-id', name: 'Received file' },
          {
            _id: 'pending-id',
            name: 'Pending invitation',
            metadata: { sharing: { status: 'new' } }
          }
        ]
      }
    })

    expect(buildSharingsQuery).toHaveBeenCalledWith({
      ids: ['shared-id', 'duplicate'],
      enabled: true
    })
    expect(useQuery).toHaveBeenCalledWith(query.definition, query.options)
    expect(useFilteredSharings).toHaveBeenCalledWith(
      expect.objectContaining({
        sharedDocumentIds: ['shared-id', 'duplicate'],
        tab: SHARING_TAB_WITH_ME
      })
    )
    expect(screen.getByRole('button', { name: 'Received file' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Pending invitation' })
    ).toBeDisabled()
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent('Sharings')
  })

  it('does not expose cached items while Sharings is loading', () => {
    setup({
      sharedDrivesLoaded: false,
      filteredResult: {
        fetchStatus: 'loaded',
        lastFetch: 1,
        data: [{ _id: 'cached-file-id', name: 'Cached file' }]
      }
    })

    expect(screen.getByTestId('fetch-status')).toHaveTextContent('loading')
    expect(
      screen.queryByRole('button', { name: 'Cached file' })
    ).not.toBeInTheDocument()
  })

  it('reports loading during a background refetch', () => {
    expect(
      getSharingsFetchStatus({
        allLoaded: true,
        sharedDrivesLoaded: true,
        filteredResult: {
          fetchStatus: 'loaded',
          isFetching: true,
          lastFetch: 1,
          data: []
        },
        sharedDrivesError: null
      })
    ).toBe('loading')
  })

  it.each([
    {
      expected: 'loading',
      allLoaded: false,
      sharedDrivesLoaded: true,
      fetchStatus: 'loaded',
      lastFetch: 1
    },
    {
      expected: 'loading',
      allLoaded: true,
      sharedDrivesLoaded: false,
      fetchStatus: 'loaded',
      lastFetch: 1
    },
    {
      expected: 'loading',
      allLoaded: true,
      sharedDrivesLoaded: true,
      fetchStatus: 'loading',
      lastFetch: 1
    },
    {
      expected: 'loading',
      allLoaded: true,
      sharedDrivesLoaded: true,
      fetchStatus: 'pending',
      lastFetch: null
    },
    {
      expected: 'failed',
      allLoaded: true,
      sharedDrivesLoaded: true,
      fetchStatus: 'failed',
      lastFetch: null
    },
    {
      expected: 'loaded',
      allLoaded: true,
      sharedDrivesLoaded: true,
      fetchStatus: 'loaded',
      lastFetch: 1
    }
  ])('reports $expected for the source state', caseState => {
    const { expected, allLoaded, sharedDrivesLoaded, fetchStatus, lastFetch } =
      caseState

    expect(
      getSharingsFetchStatus({
        allLoaded,
        sharedDrivesLoaded,
        filteredResult: { data: [], fetchStatus, lastFetch },
        sharedDrivesError: null
      })
    ).toBe(expected)
  })

  it('reports a shared-drive loading failure', () => {
    expect(
      getSharingsFetchStatus({
        allLoaded: true,
        sharedDrivesLoaded: true,
        filteredResult: { data: [], fetchStatus: 'loaded', lastFetch: 1 },
        sharedDrivesError: new Error('shared drives failed')
      })
    ).toBe('failed')
  })
})
