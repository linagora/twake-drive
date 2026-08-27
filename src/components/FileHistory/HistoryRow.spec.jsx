import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import { HistoryRow } from './HistoryRow'

const TRANSLATIONS = {
  'History.download': 'Download this version',
  'History.deleteVersion.action': 'Delete this version'
}

jest.mock('twake-i18n', () => ({
  useI18n: () => ({
    t: key => TRANSLATIONS[key] ?? key
  })
}))

const renderHistoryRow = (props = {}) => {
  const defaultProps = {
    primaryText: '28 July - 09:17',
    secondaryText: '2.3 MB',
    onDownload: jest.fn()
  }

  return {
    ...render(
      <CozyTheme>
        <HistoryRow {...defaultProps} {...props} />
      </CozyTheme>
    ),
    defaultProps
  }
}

describe('HistoryRow', () => {
  it('downloads the version when the download button is clicked', () => {
    const { defaultProps } = renderHistoryRow()

    fireEvent.click(
      screen.getByRole('button', { name: 'Download this version' })
    )

    expect(defaultProps.onDownload).toHaveBeenCalled()
  })

  it('offers no delete button when no delete handler is given', () => {
    renderHistoryRow()

    expect(screen.queryByTestId('history-row-delete')).toBe(null)
  })

  it('deletes the version when the delete button is clicked', () => {
    const onDelete = jest.fn()
    renderHistoryRow({ onDelete })

    expect(
      screen.queryByRole('button', { name: 'Delete this version' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete this version' }))

    expect(onDelete).toHaveBeenCalled()
  })
})
