import {
  fireEvent,
  render,
  RenderResult,
  screen,
  within
} from '@testing-library/react'
import React from 'react'

import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import { SharingsFilters } from './SharingsFilters'
import type { UseSharingsFiltersResult } from './useSharingsFilters'

import type { SharingsFilterValue } from '@/modules/views/Sharings/matchSharingsFilters'

const TRANSLATIONS: Record<string, string> = {
  'filters.clear_all': 'Clear all',
  'filters.date.aria_label': 'Modification date filter',
  'filters.date.clear': 'Clear Modification date filter',
  'filters.date.label': 'Modification date',
  'filters.date.options.today': 'Today',
  'filters.date.options.last_7_days': 'Last 7 days',
  'filters.date.options.last_month': 'Last month',
  'filters.date.options.this_year': 'This year',
  'filters.type.aria_label': 'Type filter',
  'filters.type.clear': 'Clear Type filter',
  'filters.type.label': 'Type',
  'filters.type.options.folder': 'Folders',
  'filters.type.options.document': 'Documents',
  'filters.type.options.spreadsheet': 'Spreadsheets',
  'filters.type.options.presentation': 'Presentations',
  'filters.type.options.photo': 'Photos',
  'filters.type.options.pdf': 'PDFs',
  'filters.type.options.video': 'Videos',
  'filters.type.options.archive': 'Archives',
  'filters.type.options.audio': 'Audio',
  'filters.type.options.draw': 'Draw',
  'filters.type.options.shortcut': 'Shortcuts'
}

jest.mock('twake-i18n', () => ({
  translate:
    () =>
    (Component: React.ComponentType): React.ComponentType =>
      Component,
  useI18n: (): { t: (key: string) => string } => ({
    t: (key: string): string => TRANSLATIONS[key] ?? key
  }),
  withOnlyLocales:
    () =>
    (Component: React.ComponentType): React.ComponentType =>
      Component
}))

interface SetupResult extends RenderResult {
  defaultProps: UseSharingsFiltersResult
}

function setup(props: Partial<UseSharingsFiltersResult> = {}): SetupResult {
  const defaultProps: UseSharingsFiltersResult = {
    clearAllFilters: jest.fn<void, []>(),
    filters: { type: null, date: null },
    hasActiveFilters: false,
    setFilter: jest.fn<void, [string, SharingsFilterValue]>(),
    supportedFilters: ['type', 'date']
  }

  return {
    ...render(
      <CozyTheme>
        <BreakpointsProvider>
          <SharingsFilters {...defaultProps} {...props} />
        </BreakpointsProvider>
      </CozyTheme>
    ),
    defaultProps
  }
}

describe('SharingsFilters', () => {
  it('changes the file type and modification date filters', () => {
    const { defaultProps } = setup()
    const fileTypeFilter = screen.getByLabelText('Type filter')
    const modificationDateFilter = screen.getByLabelText(
      'Modification date filter'
    )

    expect(screen.queryByTestId('sharings-filters')).toBeInTheDocument()
    expect(within(fileTypeFilter).queryByRole('button')).toBeInTheDocument()
    expect(
      within(modificationDateFilter).queryByRole('button')
    ).toBeInTheDocument()
    expect(screen.queryByText('Clear all')).toBe(null)

    fireEvent.mouseDown(within(fileTypeFilter).getByRole('button'))
    fireEvent.click(screen.getByRole('option', { name: 'PDFs' }))
    expect(defaultProps.setFilter).toHaveBeenCalledWith('type', 'pdf')

    fireEvent.mouseDown(within(modificationDateFilter).getByRole('button'))
    fireEvent.click(screen.getByRole('option', { name: 'Last month' }))
    expect(defaultProps.setFilter).toHaveBeenCalledWith('date', 'last-month')
  })

  it('clears individual active filters', () => {
    const { defaultProps } = setup({
      filters: { type: 'directory', date: 'last-month' },
      hasActiveFilters: true
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear Type filter' }))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clear Modification date filter'
      })
    )

    expect(defaultProps.setFilter).toHaveBeenNthCalledWith(1, 'type', null)
    expect(defaultProps.setFilter).toHaveBeenNthCalledWith(2, 'date', null)
  })

  it('clears all filters from the active state', () => {
    const { defaultProps } = setup({
      filters: { type: 'directory', date: 'today' },
      hasActiveFilters: true
    })
    const clearAllButton = screen.getByRole('button', { name: 'Clear all' })

    expect(clearAllButton.querySelector('svg')).not.toBe(null)
    fireEvent.click(clearAllButton)

    expect(defaultProps.clearAllFilters).toHaveBeenCalledTimes(1)
  })

  it('does not render when the active tab has no supported filters', () => {
    setup({ filters: {}, supportedFilters: [] })

    expect(screen.queryByTestId('sharings-filters')).toBe(null)
  })
})
