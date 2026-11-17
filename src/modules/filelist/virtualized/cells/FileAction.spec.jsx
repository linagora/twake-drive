import { render, screen } from '@testing-library/react'
import React from 'react'

import FileAction from './FileAction'

jest.mock('twake-i18n', () => ({ useI18n: () => ({ t: key => key }) }))

describe('FileAction', () => {
  it('exposes the menu button by its accessible name', () => {
    render(<FileAction onClick={jest.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Toolbar.more' })
    ).toBeInTheDocument()
  })
})
