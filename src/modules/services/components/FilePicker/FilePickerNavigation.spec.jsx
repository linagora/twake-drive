import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import useBreakpointsDefault from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { FilePickerNavigation } from './FilePickerNavigation'
import { filePickerSections } from './constants'

jest.mock('twake-i18n')
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: jest.fn()
}))

function setup({ isMobile = false } = {}) {
  const onSectionChange = jest.fn()
  useBreakpointsDefault.mockReturnValue({ isMobile })
  useI18n.mockReturnValue({ t: key => key })

  const result = render(
    <FilePickerNavigation
      activeSection={filePickerSections.DRIVE}
      onSectionChange={onSectionChange}
    />
  )

  return { ...result, onSectionChange }
}

describe('FilePickerNavigation', () => {
  it.each([
    ['desktop', false],
    ['mobile', true]
  ])('renders both sections on %s', (_, isMobile) => {
    setup({ isMobile })

    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Nav.item_drive' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(
      screen.getByRole('tab', { name: 'Nav.item_sharings' })
    ).toHaveAttribute('aria-selected', 'false')
  })

  it('uses the plain navigation style on desktop', () => {
    const { container } = setup()

    expect(container.querySelector('.MuiTabs-root.segmented')).toBe(null)
  })

  it('changes section without re-activating the current one', () => {
    const { onSectionChange } = setup()

    fireEvent.click(screen.getByRole('tab', { name: 'Nav.item_drive' }))
    expect(onSectionChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: 'Nav.item_sharings' }))
    expect(onSectionChange).toHaveBeenCalledWith(filePickerSections.SHARINGS)
  })
})
