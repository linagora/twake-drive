import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'

import { useSharingsFilters } from './useSharingsFilters'
import type { SharingsTab } from './useSharingsTab'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'

interface FiltersProbeProps {
  tab: SharingsTab
}

interface SetupOptions {
  entries?: string[]
  index?: number
  tab?: SharingsTab
}

function FiltersProbe({ tab }: FiltersProbeProps): JSX.Element {
  const {
    clearAllFilters,
    filters,
    hasActiveFilters,
    setFilter,
    supportedFilters
  } = useSharingsFilters(tab)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  return (
    <>
      <div data-testid="file-type">{filters.type ?? ''}</div>
      <div data-testid="modification-date">{filters.date ?? ''}</div>
      <div data-testid="contact">{filters.contact ?? ''}</div>
      <div data-testid="supports-file-type">
        {String(supportedFilters.includes('type'))}
      </div>
      <div data-testid="supports-modification-date">
        {String(supportedFilters.includes('date'))}
      </div>
      <div data-testid="supports-contact">
        {String(supportedFilters.includes('contact'))}
      </div>
      <div data-testid="has-active-filters">{String(hasActiveFilters)}</div>
      <div data-testid="pathname">{pathname}</div>
      <div data-testid="search">{search}</div>
      <button onClick={(): void => setFilter('type', 'pdf')}>set-pdf</button>
      <button onClick={(): void => setFilter('date', 'last-month')}>
        set-last-month
      </button>
      <button
        onClick={(): void => setFilter('contact', 'person:alice@example.com')}
      >
        set-contact
      </button>
      <button onClick={clearAllFilters}>clear-all</button>
      <button onClick={(): void => navigate(-1)}>go-back</button>
    </>
  )
}

function setup({
  entries = ['/sharings/with-me'],
  index = entries.length - 1,
  tab = SHARING_TAB_WITH_ME
}: SetupOptions = {}): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <FiltersProbe tab={tab} />
    </MemoryRouter>
  )
}

describe('useSharingsFilters', () => {
  it('reads supported filters from the URL', () => {
    setup({
      entries: [
        '/sharings/with-me?f.type=pdf&f.date=last-month&f.contact=person%3Aalice%40example.com'
      ]
    })

    expect(screen.getByTestId('file-type').textContent).toBe('pdf')
    expect(screen.getByTestId('modification-date').textContent).toBe(
      'last-month'
    )
    expect(screen.getByTestId('supports-file-type').textContent).toBe('true')
    expect(screen.getByTestId('supports-modification-date').textContent).toBe(
      'true'
    )
    expect(screen.getByTestId('contact').textContent).toBe(
      'person:alice@example.com'
    )
    expect(screen.getByTestId('supports-contact').textContent).toBe('true')
    expect(screen.getByTestId('has-active-filters').textContent).toBe('true')
  })

  it.each([SHARING_TAB_WITH_ME, SHARING_TAB_BY_ME])(
    'supports contact, file type and modification date on the %s tab',
    tab => {
      setup({ tab })

      expect(screen.getByTestId('supports-contact').textContent).toBe('true')
      expect(screen.getByTestId('supports-file-type').textContent).toBe('true')
      expect(screen.getByTestId('supports-modification-date').textContent).toBe(
        'true'
      )
    }
  )

  it('does not support filters on the Team drives tab', () => {
    setup({ tab: SHARING_TAB_DRIVES })

    expect(screen.getByTestId('supports-contact').textContent).toBe('false')
    expect(screen.getByTestId('supports-file-type').textContent).toBe('false')
    expect(screen.getByTestId('supports-modification-date').textContent).toBe(
      'false'
    )
  })

  it('replaces the current history entry when changing a filter', () => {
    setup({
      entries: ['/previous', '/sharings/with-me?foo=bar'],
      index: 1
    })

    fireEvent.click(screen.getByText('set-pdf'))

    expect(screen.getByTestId('search').textContent).toBe('?foo=bar&f.type=pdf')

    fireEvent.click(screen.getByText('set-last-month'))
    expect(screen.getByTestId('search').textContent).toBe(
      '?foo=bar&f.type=pdf&f.date=last-month'
    )

    fireEvent.click(screen.getByText('set-contact'))
    expect(screen.getByTestId('search').textContent).toBe(
      '?foo=bar&f.type=pdf&f.date=last-month&f.contact=person%3Aalice%40example.com'
    )

    fireEvent.click(screen.getByText('go-back'))
    expect(screen.getByTestId('pathname').textContent).toBe('/previous')
  })

  it('clears all search params', () => {
    setup({
      entries: ['/sharings/with-me?foo=bar&f.type=pdf&f.future=future-value']
    })

    fireEvent.click(screen.getByText('clear-all'))

    expect(screen.getByTestId('search').textContent).toBe('')
    expect(screen.getByTestId('file-type').textContent).toBe('')
    expect(screen.getByTestId('has-active-filters').textContent).toBe('false')
  })

  it('keeps duplicate and unsupported params unchanged', () => {
    setup({
      entries: [
        '/sharings/with-me?foo=bar&f.type=custom&f.type=directory&f.future=value'
      ]
    })

    expect(screen.getByTestId('search').textContent).toBe(
      '?foo=bar&f.type=custom&f.type=directory&f.future=value'
    )
    expect(screen.getByTestId('file-type').textContent).toBe('custom')
  })

  it('ignores filter params on the drives tab', () => {
    setup({
      entries: ['/sharings/drives?f.type=directory&f.date=this-year'],
      tab: SHARING_TAB_DRIVES
    })

    expect(screen.getByTestId('file-type').textContent).toBe('')
    expect(screen.getByTestId('modification-date').textContent).toBe('')
    expect(screen.getByTestId('has-active-filters').textContent).toBe('false')
  })
})
