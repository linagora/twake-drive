import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import { FileTypeFilter } from './FileTypeFilter'

const TRANSLATIONS = {
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
  useI18n: () => ({
    t: key => TRANSLATIONS[key] ?? key
  })
}))

function renderFileTypeFilter(props = {}) {
  const defaultProps = {
    onChange: jest.fn(),
    onClear: jest.fn()
  }

  return {
    ...render(
      <CozyTheme>
        <BreakpointsProvider>
          <FileTypeFilter {...defaultProps} {...props} />
        </BreakpointsProvider>
      </CozyTheme>
    ),
    defaultProps
  }
}

describe('FileTypeFilter', () => {
  it('opens the ordered menu and selects one file type', () => {
    const { defaultProps } = renderFileTypeFilter()

    expect(screen.queryByRole('option')).toBe(null)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Type' }))

    expect(screen.getAllByRole('option').map(item => item.textContent)).toEqual(
      [
        'Folders',
        'Documents',
        'Spreadsheets',
        'Presentations',
        'Photos',
        'PDFs',
        'Videos',
        'Archives',
        'Audio',
        'Draw',
        'Shortcuts'
      ]
    )

    fireEvent.click(screen.getByRole('option', { name: 'Folders' }))

    expect(defaultProps.onChange).toHaveBeenCalledWith('directory')
    expect(screen.queryByRole('option')).toBe(null)
  })

  it('clears a selected type without opening the menu', () => {
    const { defaultProps } = renderFileTypeFilter({ value: 'directory' })

    expect(screen.queryByRole('button', { name: 'Folders' })).toHaveTextContent(
      'Folders'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear Type filter' }))

    expect(defaultProps.onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('option')).toBe(null)
  })
})
