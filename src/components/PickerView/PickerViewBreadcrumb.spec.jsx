import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { I18nContext } from 'twake-i18n'

import { PickerViewBreadcrumb } from './PickerViewBreadcrumb'

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))

const renderBreadcrumb = ({ path, isMobile = false } = {}) => {
  const onBreadcrumbClick = jest.fn()
  useBreakpoints.mockReturnValue({ isMobile })

  const result = render(
    <I18nContext.Provider value={{ t: key => key }}>
      <PickerViewBreadcrumb path={path} onBreadcrumbClick={onBreadcrumbClick} />
    </I18nContext.Provider>
  )

  return { ...result, onBreadcrumbClick }
}

describe('PickerViewBreadcrumb', () => {
  it.each([false, true])(
    'renders a single Recents segment without navigation on mobile=%s',
    isMobile => {
      const { onBreadcrumbClick } = renderBreadcrumb({
        isMobile,
        path: [{ id: 'recents-root', name: 'Recents' }]
      })

      expect(screen.getByTestId('file-picker-breadcrumb')).toHaveTextContent(
        'Recents'
      )
      expect(screen.queryByRole('button')).toBe(null)
      expect(onBreadcrumbClick).not.toHaveBeenCalled()
    }
  )

  it('renders previous desktop segments as navigation buttons', () => {
    const root = { id: 'root', name: 'Root' }
    const { onBreadcrumbClick } = renderBreadcrumb({
      path: [root, { id: 'folder-id', name: 'Folder' }]
    })

    const rootButton = screen.getByRole('button', { name: 'Root' })
    expect(rootButton).toHaveAttribute('type', 'button')

    fireEvent.click(rootButton)
    expect(onBreadcrumbClick).toHaveBeenCalledWith(root)
  })

  it('renders the mobile back button and only the last segment', () => {
    const root = { id: 'root', name: 'Root' }
    const { onBreadcrumbClick } = renderBreadcrumb({
      isMobile: true,
      path: [root, { id: 'folder-id', name: 'Folder' }]
    })

    expect(screen.getByTestId('file-picker-breadcrumb')).toHaveTextContent(
      'Folder'
    )
    expect(screen.queryByRole('button', { name: 'Root' })).toBe(null)

    fireEvent.click(screen.getByRole('button', { name: 'button.back' }))
    expect(onBreadcrumbClick).toHaveBeenCalledWith(root)
  })
})
