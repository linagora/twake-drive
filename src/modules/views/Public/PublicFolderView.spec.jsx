import { render, screen } from '@testing-library/react'
import React from 'react'

import { useSharingContext } from 'cozy-sharing'

import { PublicFolderView } from './PublicFolderView'
import usePublicFilesQuery from './usePublicFilesQuery'
import { generateFileFixtures, getByTextWithMarkup } from '../testUtils'
import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

jest.mock('cozy-client/dist/hooks/useCapabilities', () =>
  jest.fn().mockReturnValue({ capabilities: {} })
)

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation()
}))

jest.mock('cozy-intent', () => ({
  WebviewIntentProvider: ({ children }) => children,
  useWebviewIntent: () => ({ call: () => {} })
}))

jest.mock('cozy-flags', () => () => true)

// Mock VirtualizedTable to render items in tests
jest.mock('cozy-ui/transpiled/react/Table/Virtualized', () => {
  const React = require('react')
  return React.forwardRef(({ rows, data }, ref) => {
    const items = data || rows || []
    return (
      <div data-testid="virtuoso-table-dnd" ref={ref}>
        {items?.map((row, index) => (
          <div key={row._id || row.id || index} className="fil-content-row">
            <span>{row.name}</span>
          </div>
        ))}
      </div>
    )
  })
})

// Remove the FolderViewBody mock - let the real component run with mocked VirtuosoTableDnd

jest.mock('../Folder/FolderViewBreadcrumb', () =>
  // eslint-disable-next-line react/display-name
  ({ rootBreadcrumbPath, currentFolderId }) => (
    <div
      data-path={rootBreadcrumbPath}
      data-folder-id={currentFolderId}
      data-testid="FolderViewBreadcrumb"
    />
  )
)
jest.mock('cozy-sharing', () => ({
  ...jest.requireActual('cozy-sharing'),
  useSharingContext: jest.fn()
}))
jest.mock('hooks', () => ({
  useCurrentFolderId: jest.fn().mockReturnValue('1234'),
  useDisplayedFolder: jest.fn().mockReturnValue({
    dir_id: 'parent-folder-id',
    _id: 'displayed-folder-id',
    name: 'My Folder'
  }),
  useParentFolder: jest.fn().mockReturnValue('5678'),
  useFolderSort: jest.fn(() => [{ attribute: 'name', order: 'asc' }, jest.fn()])
}))

jest.mock('./usePublicFilesQuery', () => {
  return jest.fn()
})
jest.mock('./usePublicWritePermissions', () => jest.fn().mockReturnValue(false))
jest.mock('cozy-keys-lib', () => ({
  useVaultClient: jest.fn()
}))
jest.mock('components/pushClient', () => ({
  isMacOS: jest.fn(() => false),
  isIOS: jest.fn(() => false),
  isLinux: jest.fn(() => false),
  isAndroid: jest.fn(() => false)
}))

useSharingContext.mockReturnValue({ byDocId: [] })

describe('Public View', () => {
  const setup = () => {
    const { store, client } = setupStoreAndClient()
    client.plugins.realtime = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    }
    client.query = jest.fn().mockReturnValue({ data: [] })

    return render(
      <AppLike client={client} store={store}>
        <PublicFolderView />
      </AppLike>
    )
  }

  // Set default mock return value for useLocation
  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      pathname: '/folder/123',
      search: '',
      state: null
    })
  })

  const updated_at = '2020-05-14T10:33:31.365224+02:00'

  beforeEach(() => {
    const nbFiles = 2
    const path = '/test'
    const dir_id = 'dirIdParent'
    const filesFixture = generateFileFixtures({
      nbFiles,
      path,
      dir_id,
      updated_at
    })
    usePublicFilesQuery.mockReturnValue({
      data: filesFixture,
      fetchStatus: 'loaded',
      refreshFolderContent: jest.fn(),
      hasMore: false,
      fetchMore: jest.fn()
    })

    useSharingContext.mockReturnValue({
      byDocId: filesFixture.reduce((acc, file) => {
        acc[file._id] = []
        return acc
      }, {})
    })
  })

  it('renders the public view', async () => {
    // TODO : Fix https://github.com/cozy/cozy-drive/issues/2913
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
    const { container } = setup()

    // Get the HTMLElement containing the filename if exist. If not throw
    const el0 = await screen.findByText(`foobar0.pdf`)
    expect(el0).toBeTruthy()

    // Check if the filename is displayed with the extension. If not throw
    getByTextWithMarkup(screen.getByText, `foobar0.pdf`)

    const virtuosoTable = container.querySelector(
      '[data-testid="virtuoso-table-dnd"]'
    )
    expect(virtuosoTable).toBeTruthy()

    const fileRows = container.querySelectorAll('.fil-content-row')
    expect(fileRows.length).toBeGreaterThan(0)
  })

  it('should use FolderViewBreadcrumb with correct rootBreadcrumbPath', async () => {
    // When
    setup()

    // Then
    expect(screen.getByTestId('FolderViewBreadcrumb')).toBeTruthy()
    expect(
      screen.getByTestId('FolderViewBreadcrumb').hasAttribute('data-path')
    ).toEqual(true)
    expect(
      screen.getByTestId('FolderViewBreadcrumb').getAttribute('data-folder-id')
    ).toEqual('1234')
  })

  describe('Refresh functionality after move/copy operations', () => {
    let mockForceRefetch

    beforeEach(() => {
      mockForceRefetch = jest.fn()
      usePublicFilesQuery.mockReturnValue({
        data: generateFileFixtures({
          nbFiles: 2,
          path: '/test',
          dir_id: 'dirIdParent',
          updated_at: '2020-05-14T10:33:31.365224+02:00'
        }),
        fetchStatus: 'loaded',
        forceRefetch: mockForceRefetch,
        hasMore: false,
        fetchMore: jest.fn()
      })

      // Reset mocks
      mockNavigate.mockClear()
      mockUseLocation.mockClear()
    })

    it('should refresh folder content when navigation state contains refresh=true', async () => {
      // Given
      mockUseLocation.mockReturnValue({
        pathname: '/folder/123',
        search: '',
        state: { refresh: true }
      })

      const { store, client } = setupStoreAndClient()
      client.plugins.realtime = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      }
      client.query = jest.fn().mockReturnValue({ data: [] })

      // Mock console methods to suppress logs during test
      jest.spyOn(console, 'warn').mockImplementation()
      jest.spyOn(console, 'error').mockImplementation()
      jest.spyOn(console, 'log').mockImplementation()

      // When - render with navigation state containing refresh signal
      render(
        <AppLike client={client} store={store}>
          <PublicFolderView />
        </AppLike>
      )

      // Then - forceRefetch should be called
      expect(mockForceRefetch).toHaveBeenCalledTimes(1)
    })

    it('should not refresh folder content when navigation state does not contain refresh signal', async () => {
      // Given
      mockUseLocation.mockReturnValue({
        pathname: '/folder/123',
        search: '',
        state: null
      })

      const { store, client } = setupStoreAndClient()
      client.plugins.realtime = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      }
      client.query = jest.fn().mockReturnValue({ data: [] })

      // Mock console methods to suppress logs during test
      jest.spyOn(console, 'warn').mockImplementation()
      jest.spyOn(console, 'error').mockImplementation()
      jest.spyOn(console, 'log').mockImplementation()

      // When - render without refresh signal in navigation state
      render(
        <AppLike client={client} store={store}>
          <PublicFolderView />
        </AppLike>
      )

      // Then - forceRefetch should not be called
      expect(mockForceRefetch).not.toHaveBeenCalled()
    })

    it('should clear navigation state after refreshing to prevent repeated refreshes', async () => {
      // Given
      mockUseLocation.mockReturnValue({
        pathname: '/folder/123',
        search: '',
        state: { refresh: true }
      })

      const { store, client } = setupStoreAndClient()
      client.plugins.realtime = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      }
      client.query = jest.fn().mockReturnValue({ data: [] })

      // Mock console methods to suppress logs during test
      jest.spyOn(console, 'warn').mockImplementation()
      jest.spyOn(console, 'error').mockImplementation()
      jest.spyOn(console, 'log').mockImplementation()

      // When - render with navigation state containing refresh signal
      render(
        <AppLike client={client} store={store}>
          <PublicFolderView />
        </AppLike>
      )

      // Then - navigate should be called to clear the state
      expect(mockNavigate).toHaveBeenCalledWith('/folder/123', {
        replace: true,
        state: null
      })
    })
  })
})
