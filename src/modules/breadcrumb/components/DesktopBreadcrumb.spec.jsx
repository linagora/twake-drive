import { render, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { useI18n } from 'twake-i18n'

import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import DesktopBreadcrumb from './DesktopBreadcrumb'
import {
  dummyBreadcrumbPathNoRootLarge,
  dummyBreadcrumbPathNoRootSmall,
  dummyBreadcrumbPathWithRootLarge,
  dummyBreadcrumbPathWithRootSmall,
  dummyBreadcrumbPathWithSharedDriveLarge,
  dummyBreadcrumbPathWithSharedDriveSmall
} from 'test/dummies/dummyBreadcrumbPath'

jest.mock('cozy-ui/transpiled/react/ActionsMenu', () => ({ children }) => (
  <div data-testid="action-menu">{children}</div>
))
jest.mock(
  'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem',
  () =>
    ({ children }) =>
      <div data-testid="action-menu-item">{children}</div>
)

jest.mock('twake-i18n')
describe('DesktopBreadcrumb', () => {
  beforeEach(() => {
    useI18n.mockReturnValue({ t: () => 'Show path' })
  })

  describe('template', () => {
    describe('When parent is ROOT folder', () => {
      it('should display breadcrumb with | 📁 > "..." > parent > current | when more than 3 nested folders', () => {
        // When
        const { container, queryByText } = render(
          <DesktopBreadcrumb path={dummyBreadcrumbPathWithRootLarge()} />
        )

        // Then
        expect(container.querySelector('[aria-label="Drive"]')).toBeTruthy()
        expect(queryByText('grandparent')).toBeFalsy()
        expect(queryByText('parent')).toBeTruthy()
        expect(queryByText('current')).toBeTruthy()
        expect(container.querySelector('[aria-label="Show path"]')).toBeTruthy()
        expect(container.querySelector('.fil-path-separator')).toBeTruthy()
      })

      it('should display breadcrumb with | 📁 > parent > current | when 3 nested folders or less', () => {
        // When
        const { container, queryByText } = render(
          <DesktopBreadcrumb path={dummyBreadcrumbPathWithRootSmall()} />
        )

        // Then
        expect(container.querySelector('[aria-label="Drive"]')).toBeTruthy()
        expect(queryByText('grandparent')).toBeFalsy()
        expect(queryByText('parent')).toBeTruthy()
        expect(queryByText('current')).toBeTruthy()
        expect(container.querySelector('[aria-label="Show path"]')).toBeFalsy()
        expect(container.querySelector('.fil-path-separator')).toBeTruthy()
      })
    })

    describe('When parent is a Shared drive', () => {
      it('should display breadcrumb with | 📁 > "..." > parent > current | when more than 3 nested folders', () => {
        // When
        const { container, queryByText } = render(
          <DesktopBreadcrumb path={dummyBreadcrumbPathWithSharedDriveLarge()} />
        )

        // Then
        expect(
          container.querySelector('[aria-label="Shared Drive"]')
        ).toBeTruthy()
        expect(queryByText('grandparent')).toBeFalsy()
        expect(queryByText('parent')).toBeTruthy()
        expect(queryByText('current')).toBeTruthy()
        expect(container.querySelector('[aria-label="Show path"]')).toBeTruthy()
        expect(container.querySelector('.fil-path-separator')).toBeTruthy()
      })

      it('should display breadcrumb with | 📁 > parent > current | when 3 nested folders or less', () => {
        // When
        const { container, queryByText } = render(
          <DesktopBreadcrumb path={dummyBreadcrumbPathWithSharedDriveSmall()} />
        )

        // Then
        expect(
          container.querySelector('[aria-label="Shared Drive"]')
        ).toBeTruthy()
        expect(queryByText('grandparent')).toBeFalsy()
        expect(queryByText('parent')).toBeTruthy()
        expect(queryByText('current')).toBeTruthy()
        expect(container.querySelector('[aria-label="Show path"]')).toBeFalsy()
        expect(container.querySelector('.fil-path-separator')).toBeTruthy()
      })
    })

    describe('When parent is nor ROOT nor Shared drive', () => {
      it('should display breadcrumb with | Drive > "..." > parent > current | when more than 3 nested folders', () => {
        // When
        const { container, queryByText } = render(
          <DesktopBreadcrumb path={dummyBreadcrumbPathNoRootLarge()} />
        )

        // Then
        expect(queryByText('Some Main Folder')).toBeTruthy()
        expect(queryByText('grandparent')).toBeFalsy()
        expect(queryByText('parent')).toBeTruthy()
        expect(queryByText('current')).toBeTruthy()
        expect(container.querySelector('[aria-label="Show path"]')).toBeTruthy()
        expect(container.querySelector('.fil-path-separator')).toBeTruthy()
      })

      it('should display breadcrumb with | Drive > parent > current | when 3 nested folders or less', () => {
        // When
        const { container, queryByText } = render(
          <DesktopBreadcrumb path={dummyBreadcrumbPathNoRootSmall()} />
        )

        // Then
        expect(queryByText('Some Main Folder')).toBeTruthy()
        expect(queryByText('parent')).toBeTruthy()
        expect(queryByText('current')).toBeTruthy()
        expect(container.querySelector('[aria-label="Show path"]')).toBeFalsy()
        expect(container.querySelector('.fil-path-separator')).toBeTruthy()
      })
    })

    it('should have convenient style on Public view - on desktop', () => {
      // When
      const { container } = render(
        <DesktopBreadcrumb path={dummyBreadcrumbPathWithRootLarge()} />
      )

      // Then
      expect(container.querySelector('.fil-path-backdrop')).toBeTruthy()
    })
  })

  describe('mount', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => {
      // eslint-disable-next-line no-console
      console.error.mockRestore()
    })
    it('should hide menu displayed while navigating', async () => {
      // Given
      const { container, queryByTestId, rerender } = await render(
        <DesktopBreadcrumb path={dummyBreadcrumbPathWithRootLarge()} />
      )
      act(() => {
        container.querySelector('[aria-label="Show path"]').click()
      })
      expect(queryByTestId('action-menu')).toBeInTheDocument()

      // When
      rerender(<DesktopBreadcrumb path={dummyBreadcrumbPathWithRootLarge()} />)

      // Then
      expect(queryByTestId('action-menu')).not.toBeInTheDocument()
    })

    it('should update dropdown trigger while navigating - on public page', async () => {
      // Given
      const { container, rerender } = await render(
        <DesktopBreadcrumb path={[]} />
      )

      expect(container.querySelector('[aria-label="Show path"]')).toBeNull()

      rerender(<DesktopBreadcrumb path={dummyBreadcrumbPathWithRootLarge()} />)

      // When
      act(() => {
        container.querySelector('[aria-label="Show path"]').click()
      })

      // Then
      expect(container.querySelector('[aria-label="Show path"]')).not.toBeNull()
    })
  })

  describe('events', () => {
    it('should dispatch on breadcrumb click - on desktop', () => {
      // Given
      const onBreadcrumbClick = jest.fn()
      const path = dummyBreadcrumbPathWithRootLarge()

      const { queryByText } = render(
        <DesktopBreadcrumb path={path} onBreadcrumbClick={onBreadcrumbClick} />
      )

      // When
      queryByText('parent').click()

      // Then
      expect(onBreadcrumbClick).toHaveBeenCalledWith(path[2])
    })

    it('should display action menu on click on "..." on desktop', () => {
      // Given
      const path = dummyBreadcrumbPathWithRootLarge()

      const { container, queryByTestId } = render(
        <BreakpointsProvider>
          <DesktopBreadcrumb path={path} />
        </BreakpointsProvider>
      )

      // When
      act(() => {
        container.querySelector('[aria-label="Show path"]').click()
      })

      // Then
      expect(queryByTestId('action-menu')).toBeInTheDocument()
      expect(queryByTestId('action-menu-item')).toBeInTheDocument()
    })

    it('should add grandParents only in dropdown - on click on ... on desktop', () => {
      // Given
      const path = dummyBreadcrumbPathWithRootLarge()

      const { container, queryByText } = render(
        <BreakpointsProvider>
          <DesktopBreadcrumb path={path} />
        </BreakpointsProvider>
      )

      // When
      act(() => {
        container.querySelector('[aria-label="Show path"]').click()
      })

      // Then
      expect(container.querySelectorAll('.MuiBreadcrumbs-li')[1]).not.toEqual(
        'grandParents'
      )
      expect(queryByText('grandParent')).toBeInTheDocument()
    })

    it('should handle on click outside on desktop - removing dropdown', () => {
      // Given
      const path = dummyBreadcrumbPathWithRootLarge()

      const { container, queryByText } = render(
        <div>
          <button onClick={jest.fn()} />
          <DesktopBreadcrumb path={path} />
        </div>
      )

      // When
      fireEvent.click(container.querySelector('button'))

      // Then
      expect(queryByText('grandParent')).not.toBeInTheDocument()
      expect(container.querySelector('.dropdown')).not.toBeInTheDocument()
    })
  })
})
