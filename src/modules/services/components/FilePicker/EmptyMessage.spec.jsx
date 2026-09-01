import { render, screen } from '@testing-library/react'
import React from 'react'

import { useI18n } from 'twake-i18n'

import { EmptyMessage } from './EmptyMessage'
import { filePickerSections } from './constants'

jest.mock('twake-i18n')

describe('EmptyMessage', () => {
  beforeEach(() => {
    useI18n.mockReturnValue({ t: key => key })
  })

  afterEach(() => jest.clearAllMocks())

  it('shows the sharing empty state at the Sharings root', () => {
    render(<EmptyMessage section={filePickerSections.SHARINGS} isRoot />)

    expect(screen.getByTestId('file-picker-empty')).toHaveTextContent(
      'empty.sharing_text'
    )
  })

  it('shows the folder empty state inside a shared folder', () => {
    render(<EmptyMessage section={filePickerSections.SHARINGS} />)

    expect(screen.getByTestId('file-picker-empty')).toHaveTextContent(
      'empty.title'
    )
  })
})
