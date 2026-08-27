import {
  fireEvent,
  render,
  screen,
  type RenderResult,
  within
} from '@testing-library/react'
import React from 'react'

import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import {
  ContactFilter,
  type ContactFilterOption,
  type ContactFilterProps
} from './ContactFilter'

const TRANSLATIONS: Record<string, string | undefined> = {
  'filters.contact.clear': 'Clear Contact filter',
  'filters.contact.label': 'Contact',
  'filters.contact.me': 'me',
  'loading.message': 'Loading',
  'search.action': 'Search',
  'search.empty.title': 'No result'
}

interface I18nMock {
  t: (key: string) => string
}

const OPTIONS = [
  {
    avatar: <span aria-hidden="true">TJ</span>,
    value: 'contact:thomas',
    label: 'Thomas Jolly',
    secondaryLabel: 'tdesign25@gmail.com',
    isCurrentUser: true
  },
  {
    avatar: <span aria-hidden="true">ÉM</span>,
    value: 'contact:elodie',
    label: 'Élodie Martin',
    secondaryLabel: 'elodie@example.com'
  },
  {
    avatar: <span aria-hidden="true">DT</span>,
    value: 'group:design',
    label: 'Design team',
    secondaryLabel: '4 members'
  }
] satisfies ContactFilterOption[]

const MANY_OPTIONS = Array.from(
  { length: 25 },
  (_value: unknown, index: number): ContactFilterOption => {
    const contactNumber = index + 1

    return {
      avatar: <span aria-hidden="true">{contactNumber}</span>,
      value: `contact:${contactNumber}`,
      label: `Contact ${contactNumber}`,
      secondaryLabel: `contact${contactNumber}@example.com`
    }
  }
)

jest.mock('twake-i18n', () => ({
  translate:
    () =>
    (Component: React.ComponentType): React.ComponentType =>
      Component,
  withOnlyLocales:
    () =>
    (Component: React.ComponentType): React.ComponentType =>
      Component,
  useExtendI18n: jest.fn(),
  useI18n: (): I18nMock => ({
    t: (key: string): string => TRANSLATIONS[key] ?? key
  })
}))

type RenderContactFilterResult = RenderResult & {
  defaultProps: ContactFilterProps
}

const renderContactFilter = (
  props: Partial<ContactFilterProps> = {}
): RenderContactFilterResult => {
  const defaultProps: ContactFilterProps = {
    onChange: jest.fn(),
    onClear: jest.fn(),
    options: OPTIONS
  }

  return {
    ...render(
      <CozyTheme>
        <BreakpointsProvider>
          <ContactFilter {...defaultProps} {...props} />
        </BreakpointsProvider>
      </CozyTheme>
    ),
    defaultProps
  }
}

const openContactFilter = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Contact' }))
}

describe('ContactFilter', () => {
  it('opens the autocomplete and selects a group', () => {
    const { defaultProps } = renderContactFilter()

    expect(screen.queryByRole('listbox')).toBe(null)
    openContactFilter()

    expect(
      screen.queryByRole('option', { name: /Thomas Jolly \(me\)/ })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'design' }
    })

    expect(
      screen.queryByRole('option', { name: /Design team/ })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('option', { name: /Design team/ }))

    expect(defaultProps.onChange).toHaveBeenCalledWith('group:design')
    expect(screen.queryByRole('listbox')).toBe(null)
  })

  it('matches names without accents and email addresses', () => {
    renderContactFilter()
    openContactFilter()

    const searchInput = screen.getByRole('searchbox', { name: 'Search' })

    fireEvent.change(searchInput, {
      target: { value: 'elodie' }
    })
    expect(
      screen.queryByRole('option', { name: /Élodie Martin/ })
    ).toBeInTheDocument()

    fireEvent.change(searchInput, {
      target: { value: 'tdesign25@gmail.com' }
    })
    expect(
      screen.queryByRole('option', { name: /Thomas Jolly/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Élodie Martin/ })).toBe(null)
  })

  it('clears the contact search through the clear button', () => {
    renderContactFilter()
    openContactFilter()

    const searchInput = screen.getByRole('searchbox', { name: 'Search' })
    fireEvent.change(searchInput, { target: { value: 'elodie' } })

    const searchForm = searchInput.closest('form')
    if (searchForm === null) throw new Error('Search form not found')

    fireEvent.click(within(searchForm).getByRole('button'))

    expect(searchInput).toHaveValue('')
    expect(within(searchForm).queryByRole('button')).toBe(null)
    expect(screen.queryAllByRole('option')).toHaveLength(OPTIONS.length)
  })

  it('limits suggestions and finds options beyond the limit through search', () => {
    renderContactFilter({ options: MANY_OPTIONS })
    openContactFilter()

    expect(screen.queryAllByRole('option')).toHaveLength(20)
    expect(screen.queryByRole('option', { name: /Contact 25/ })).toBe(null)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'Contact 25' }
    })

    expect(
      screen.queryByRole('option', { name: /Contact 25/ })
    ).toBeInTheDocument()
  })

  it('clears a selected contact without opening the autocomplete', () => {
    const { defaultProps } = renderContactFilter({
      value: 'contact:thomas'
    })

    expect(
      screen.queryByRole('button', { name: 'Thomas Jolly' })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear Contact filter' })
    )

    expect(defaultProps.onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('listbox')).toBe(null)
  })

  it('shows the loading and empty states', () => {
    const { rerender } = renderContactFilter({ loading: true })

    openContactFilter()
    expect(screen.queryByRole('status')).toHaveTextContent('Loading')

    rerender(
      <CozyTheme>
        <BreakpointsProvider>
          <ContactFilter
            onChange={jest.fn()}
            onClear={jest.fn()}
            options={[]}
          />
        </BreakpointsProvider>
      </CozyTheme>
    )

    expect(screen.queryByRole('status')).toHaveTextContent('No result')
    expect(screen.queryByText('No result')).toHaveClass(
      'MuiTypography-colorTextSecondary'
    )
  })

  it('does not open the autocomplete from its wrapper when disabled', () => {
    renderContactFilter({ disabled: true })
    const trigger = screen.getByRole('button', { name: 'Contact' })

    fireEvent.click(trigger.parentElement as HTMLElement)

    expect(screen.queryByRole('listbox')).toBe(null)
  })
})
