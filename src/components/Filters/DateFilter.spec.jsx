import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import { DateFilter } from './DateFilter'

const TRANSLATIONS = {
  'filters.date.aria_label': 'Modification date filter',
  'filters.date.clear': 'Clear Modification date filter',
  'filters.date.label': 'Modification date',
  'filters.date.options.today': 'Today',
  'filters.date.options.last_7_days': 'Last 7 days',
  'filters.date.options.last_month': 'Last month',
  'filters.date.options.this_year': 'This year'
}

jest.mock('twake-i18n', () => ({
  useI18n: () => ({
    t: key => TRANSLATIONS[key] ?? key
  })
}))

function renderDateFilter(props = {}) {
  const defaultProps = {
    onChange: jest.fn(),
    onClear: jest.fn()
  }

  return {
    ...render(
      <CozyTheme>
        <BreakpointsProvider>
          <DateFilter {...defaultProps} {...props} />
        </BreakpointsProvider>
      </CozyTheme>
    ),
    defaultProps
  }
}

describe('DateFilter', () => {
  it('opens the ordered preset menu and selects one date range', () => {
    const { defaultProps } = renderDateFilter()

    expect(screen.queryByRole('option')).toBe(null)
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'Modification date' })
    )

    expect(screen.getAllByRole('option').map(item => item.textContent)).toEqual(
      ['Today', 'Last 7 days', 'Last month', 'This year']
    )

    fireEvent.click(screen.getByRole('option', { name: 'Last 7 days' }))

    expect(defaultProps.onChange).toHaveBeenCalledWith('last-7-days')
    expect(screen.queryByRole('option')).toBe(null)
  })

  it('clears a selected date range without opening the menu', () => {
    const { defaultProps } = renderDateFilter({ value: 'last-month' })

    expect(
      screen.queryByRole('button', { name: 'Last month' })
    ).toHaveTextContent('Last month')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clear Modification date filter'
      })
    )

    expect(defaultProps.onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('option')).toBe(null)
  })
})
