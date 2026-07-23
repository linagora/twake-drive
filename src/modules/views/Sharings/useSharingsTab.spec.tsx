import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom'

import flag from 'cozy-flags'

import {
  SharingsTab,
  SharingsTabProvider,
  useSharingsTab
} from './useSharingsTab'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'
import logger from '@/lib/logger'

jest.mock('cozy-flags', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() }
}))

const mockFlag = flag as unknown as jest.Mock
const mockLogger = logger as unknown as { warn: jest.Mock }

function enableSharedDrives(): void {
  mockFlag.mockImplementation(
    (name: string) => name === 'drive.shared-drive.enabled'
  )
}

function TabProbe(): JSX.Element {
  const [tab, setTab] = useSharingsTab()
  const { pathname, search, key } = useLocation()
  const navigate = useNavigate()

  return (
    <>
      <div data-testid="tab">{tab}</div>
      <div data-testid="pathname">{pathname}</div>
      <div data-testid="search">{search}</div>
      <div data-testid="location-key">{key}</div>
      <button onClick={(): void => setTab(SHARING_TAB_DRIVES)}>
        go-drives
      </button>
      <button onClick={(): void => setTab(SHARING_TAB_BY_ME)}>go-by-me</button>
      <button
        onClick={(): void => setTab(SHARING_TAB_WITH_ME, { replace: true })}
      >
        replace-with-me
      </button>
      <button onClick={(): void => navigate(-1)}>go-back</button>
    </>
  )
}

function TabRoute({ tab }: { tab: SharingsTab }): JSX.Element {
  return (
    <SharingsTabProvider tab={tab}>
      <TabProbe />
    </SharingsTabProvider>
  )
}

function renderWithRoute(route: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/sharings/with-me/*"
          element={<TabRoute tab={SHARING_TAB_WITH_ME} />}
        />
        <Route
          path="/sharings/by-me/*"
          element={<TabRoute tab={SHARING_TAB_BY_ME} />}
        />
        <Route
          path="/sharings/drives/*"
          element={<TabRoute tab={SHARING_TAB_DRIVES} />}
        />
      </Routes>
    </MemoryRouter>
  )
}

function getTab(): string | null {
  return screen.getByTestId('tab').textContent
}

function getPathname(): string | null {
  return screen.getByTestId('pathname').textContent
}

function getSearch(): string | null {
  return screen.getByTestId('search').textContent
}

describe('useSharingsTab', () => {
  beforeEach(() => {
    mockFlag.mockReturnValue(false)
  })

  it.each([
    [SHARING_TAB_WITH_ME, '/sharings/with-me'],
    [SHARING_TAB_BY_ME, '/sharings/by-me']
  ])('uses the %s tab from its route', (tab, route) => {
    renderWithRoute(route)

    expect(getTab()).toBe(tab)
    expect(getPathname()).toBe(route)
  })

  it('accepts the drives route while a shared-drive flag is enabled', () => {
    enableSharedDrives()

    renderWithRoute('/sharings/drives')

    expect(getTab()).toBe(SHARING_TAB_DRIVES)
    expect(getPathname()).toBe('/sharings/drives')
  })

  it('redirects the drives route to the default tab when the feature is disabled', async () => {
    renderWithRoute('/sharings/drives')

    await waitFor(() => {
      expect(getTab()).toBe(SHARING_TAB_WITH_ME)
      expect(getPathname()).toBe('/sharings/with-me')
    })
  })

  it('preserves a nested path when its tab becomes unavailable', async () => {
    renderWithRoute(
      '/sharings/drives/folder/folder-1/file/file-1?foo=bar&tab=drives'
    )

    await waitFor(() => {
      expect(getTab()).toBe(SHARING_TAB_WITH_ME)
      expect(getPathname()).toBe(
        '/sharings/with-me/folder/folder-1/file/file-1'
      )
      expect(getSearch()).toBe('?foo=bar')
    })
  })

  it('updates the route when setTab is called', () => {
    enableSharedDrives()
    renderWithRoute('/sharings/with-me')

    fireEvent.click(screen.getByText('go-drives'))

    expect(getTab()).toBe(SHARING_TAB_DRIVES)
    expect(getPathname()).toBe('/sharings/drives')
  })

  it('ignores setTab calls targeting an unavailable tab', () => {
    renderWithRoute('/sharings/by-me')

    fireEvent.click(screen.getByText('go-drives'))

    expect(getTab()).toBe(SHARING_TAB_BY_ME)
    expect(getPathname()).toBe('/sharings/by-me')
    expect(mockLogger.warn).toHaveBeenCalledTimes(1)
  })

  it('does not navigate when re-selecting the active tab', () => {
    renderWithRoute('/sharings/by-me')
    const keyBefore = screen.getByTestId('location-key').textContent

    fireEvent.click(screen.getByText('go-by-me'))

    expect(getTab()).toBe(SHARING_TAB_BY_ME)
    expect(screen.getByTestId('location-key').textContent).toBe(keyBefore)
  })

  it('pushes a history entry so back returns to the previous tab', () => {
    enableSharedDrives()
    renderWithRoute('/sharings/by-me')

    fireEvent.click(screen.getByText('go-drives'))
    expect(getTab()).toBe(SHARING_TAB_DRIVES)

    fireEvent.click(screen.getByText('go-back'))
    expect(getTab()).toBe(SHARING_TAB_BY_ME)
    expect(getPathname()).toBe('/sharings/by-me')
  })

  it('can replace the current history entry', () => {
    renderWithRoute('/sharings/by-me')

    fireEvent.click(screen.getByText('replace-with-me'))
    expect(getTab()).toBe(SHARING_TAB_WITH_ME)

    fireEvent.click(screen.getByText('go-back'))
    expect(getTab()).toBe(SHARING_TAB_WITH_ME)
    expect(getPathname()).toBe('/sharings/with-me')
  })

  it('preserves unrelated query params', () => {
    enableSharedDrives()
    renderWithRoute('/sharings/with-me?foo=bar')

    fireEvent.click(screen.getByText('go-drives'))

    expect(getPathname()).toBe('/sharings/drives')
    expect(getSearch()).toBe('?foo=bar')
  })
})
