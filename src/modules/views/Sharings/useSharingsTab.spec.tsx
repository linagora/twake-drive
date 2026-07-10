import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'

import flag from 'cozy-flags'

import { useSharingsTab } from './useSharingsTab'

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

const enableSharedDrives = (): void => {
  mockFlag.mockImplementation(
    (name: string) => name === 'drive.shared-drive.enabled'
  )
}

const TabProbe = (): JSX.Element => {
  const [tab, setTab] = useSharingsTab()
  const { search, key } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <div data-testid="tab">{tab}</div>
      <div data-testid="search">{search}</div>
      <div data-testid="location-key">{key}</div>
      <button onClick={(): void => setTab(SHARING_TAB_DRIVES)}>
        go-drives
      </button>
      <button onClick={(): void => setTab(SHARING_TAB_BY_ME)}>go-by-me</button>
      <button onClick={(): void => navigate(-1)}>go-back</button>
    </>
  )
}

const renderWithSearch = (search = ''): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={[`/sharings${search}`]}>
      <TabProbe />
    </MemoryRouter>
  )

const getTab = (): string | null => screen.getByTestId('tab').textContent
const getSearch = (): string | null => screen.getByTestId('search').textContent

describe('useSharingsTab', () => {
  beforeEach(() => {
    mockFlag.mockReturnValue(false)
  })

  it('defaults to the "with me" tab and canonicalizes the URL when no param is set', () => {
    renderWithSearch()

    expect(getTab()).toBe(SHARING_TAB_WITH_ME)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_WITH_ME}`)
  })

  it('uses the tab from the URL when it is valid', () => {
    renderWithSearch(`?tab=${SHARING_TAB_BY_ME}`)

    expect(getTab()).toBe(SHARING_TAB_BY_ME)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_BY_ME}`)
  })

  it('canonicalizes the legacy numeric param to the default tab', () => {
    renderWithSearch('?tab=1')

    expect(getTab()).toBe(SHARING_TAB_WITH_ME)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_WITH_ME}`)
  })

  it('canonicalizes an unrecognized param to the default tab', () => {
    renderWithSearch('?tab=nonsense')

    expect(getTab()).toBe(SHARING_TAB_WITH_ME)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_WITH_ME}`)
  })

  it('accepts the drives tab while a shared-drive flag is enabled', () => {
    enableSharedDrives()

    renderWithSearch(`?tab=${SHARING_TAB_DRIVES}`)

    expect(getTab()).toBe(SHARING_TAB_DRIVES)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_DRIVES}`)
  })

  it('canonicalizes a drives deep link to the default tab when the feature is disabled', () => {
    renderWithSearch(`?tab=${SHARING_TAB_DRIVES}`)

    expect(getTab()).toBe(SHARING_TAB_WITH_ME)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_WITH_ME}`)
  })

  it('updates the tab and the URL when setTab is called', () => {
    enableSharedDrives()
    renderWithSearch(`?tab=${SHARING_TAB_WITH_ME}`)

    fireEvent.click(screen.getByText('go-drives'))

    expect(getTab()).toBe(SHARING_TAB_DRIVES)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_DRIVES}`)
  })

  it('ignores setTab calls targeting an unavailable tab', () => {
    renderWithSearch(`?tab=${SHARING_TAB_BY_ME}`)

    fireEvent.click(screen.getByText('go-drives'))

    expect(getTab()).toBe(SHARING_TAB_BY_ME)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_BY_ME}`)
    expect(mockLogger.warn).toHaveBeenCalledTimes(1)
  })

  it('does not navigate when re-selecting the already active tab', () => {
    renderWithSearch(`?tab=${SHARING_TAB_BY_ME}`)
    const keyBefore = screen.getByTestId('location-key').textContent

    fireEvent.click(screen.getByText('go-by-me'))

    expect(getTab()).toBe(SHARING_TAB_BY_ME)
    expect(screen.getByTestId('location-key').textContent).toBe(keyBefore)
  })

  it('pushes a history entry on setTab so back returns to the previous tab', () => {
    enableSharedDrives()
    renderWithSearch(`?tab=${SHARING_TAB_BY_ME}`)

    fireEvent.click(screen.getByText('go-drives'))
    expect(getTab()).toBe(SHARING_TAB_DRIVES)

    fireEvent.click(screen.getByText('go-back'))
    expect(getTab()).toBe(SHARING_TAB_BY_ME)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_BY_ME}`)
  })

  it('returns to the canonicalized entry when going back after a tab switch', () => {
    renderWithSearch('?tab=1')
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_WITH_ME}`)

    fireEvent.click(screen.getByText('go-by-me'))
    expect(getTab()).toBe(SHARING_TAB_BY_ME)

    fireEvent.click(screen.getByText('go-back'))
    expect(getTab()).toBe(SHARING_TAB_WITH_ME)
    expect(getSearch()).toBe(`?tab=${SHARING_TAB_WITH_ME}`)
  })

  it('preserves unrelated query params', () => {
    enableSharedDrives()
    renderWithSearch(`?foo=bar&tab=${SHARING_TAB_WITH_ME}`)

    fireEvent.click(screen.getByText('go-drives'))

    expect(getSearch()).toContain('foo=bar')
    expect(getSearch()).toContain(`tab=${SHARING_TAB_DRIVES}`)
  })

  it('keeps unrelated query params when canonicalizing', () => {
    renderWithSearch('?foo=bar&tab=1')

    expect(getSearch()).toContain('foo=bar')
    expect(getSearch()).toContain(`tab=${SHARING_TAB_WITH_ME}`)
  })
})
