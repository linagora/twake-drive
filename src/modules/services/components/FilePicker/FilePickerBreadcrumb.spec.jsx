import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useI18n } from 'twake-i18n'

import FilePickerBreadcrumb from './FilePickerBreadcrumb'

jest.mock('twake-i18n')
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: () => ({ isMobile: false })
}))

describe('FilePickerBreadcrumb', () => {
  it('renders previous desktop segments as navigation buttons', () => {
    const onBreadcrumbClick = jest.fn()
    const sharingsRoot = { id: 'sharings-root', name: 'Sharings' }
    useI18n.mockReturnValue({ t: key => key })

    render(
      <FilePickerBreadcrumb
        path={[sharingsRoot, { id: 'folder-id', name: 'Folder' }]}
        onBreadcrumbClick={onBreadcrumbClick}
      />
    )

    const rootButton = screen.getByRole('button', { name: 'Sharings' })
    expect(rootButton).toHaveAttribute('type', 'button')

    fireEvent.click(rootButton)
    expect(onBreadcrumbClick).toHaveBeenCalledWith(sharingsRoot)
  })
})
