import { render, fireEvent } from '@testing-library/react'
import React from 'react'

import FolderViewBreadcrumb from './FolderViewBreadcrumb'
import {
  dummyBreadcrumbPathWithRootLarge,
  dummyRootBreadcrumbPath
} from 'test/dummies/dummyBreadcrumbPath'

import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'

const mockNavigate = jest.fn()
const mockLocation = jest.fn()

jest.mock('modules/breadcrumb/hooks/useBreadcrumbPath')
jest.mock('modules/breadcrumb/components/MobileAwareBreadcrumb', () => ({
  MobileAwareBreadcrumb: ({ path, opening, onBreadcrumbClick }) => (
    <div
      data-testid="MobileAwareBreadcrumb"
      data-path={path}
      data-opening={opening ? 'true' : 'false'}
    >
      {path.map(item => (
        <button key={item.name} onClick={() => onBreadcrumbClick(item)}>
          {item.name}
        </button>
      ))}
    </div>
  )
}))
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation()
}))

describe('FolderViewBreadcrumb', () => {
  const rootBreadcrumbPath = dummyRootBreadcrumbPath()

  beforeEach(() => {
    mockLocation.mockReturnValue({ pathname: '/folder/folder-1', search: '' })
  })

  it('should use breadcrumb path', () => {
    // Given
    const currentFolderId = '1234'
    const sharedDocumentIds = [currentFolderId, '5678']

    // When
    render(
      <FolderViewBreadcrumb
        currentFolderId={currentFolderId}
        rootBreadcrumbPath={rootBreadcrumbPath}
        sharedDocumentIds={sharedDocumentIds}
      />
    )

    // Then
    expect(useBreadcrumbPath).toHaveBeenCalledWith({
      currentFolderId,
      rootBreadcrumbPath,
      sharedDocumentIds
    })
  })

  it('should set correct path in template', () => {
    // Given
    useBreadcrumbPath.mockReturnValue(dummyBreadcrumbPathWithRootLarge())

    // When
    const { getByTestId } = render(
      <FolderViewBreadcrumb
        currentFolderId="1234"
        rootBreadcrumbPath={rootBreadcrumbPath}
      />
    )

    // Then
    expect(getByTestId('MobileAwareBreadcrumb')).toBeTruthy()
    expect(
      getByTestId('MobileAwareBreadcrumb').hasAttribute('data-path')
    ).toEqual(true)
    expect(
      getByTestId('MobileAwareBreadcrumb').getAttribute('data-opening')
    ).toEqual('false')
  })

  it('should render skeleton when path empty', () => {
    // Given
    useBreadcrumbPath.mockReturnValue([])

    // When
    const { getByTestId, queryByTestId } = render(
      <FolderViewBreadcrumb
        currentFolderId="1234"
        rootBreadcrumbPath={rootBreadcrumbPath}
      />
    )

    // Then
    expect(getByTestId('breadcrumb-skeleton')).toBeTruthy()
    expect(queryByTestId('MobileAwareBreadcrumb')).toBeNull()
  })

  it('should render skeleton when path undefined', () => {
    // Given
    useBreadcrumbPath.mockReturnValue()

    // When
    const { getByTestId, queryByTestId } = render(
      <FolderViewBreadcrumb
        currentFolderId="1234"
        rootBreadcrumbPath={rootBreadcrumbPath}
      />
    )

    // Then
    expect(getByTestId('breadcrumb-skeleton')).toBeTruthy()
    expect(queryByTestId('MobileAwareBreadcrumb')).toBeNull()
  })

  describe('navigation', () => {
    beforeEach(() => {
      useBreadcrumbPath.mockReturnValue([
        { name: 'Sharings' },
        { id: 'parent-1', name: 'Parent' },
        { id: 'folder-1', name: 'Current' }
      ])
    })

    const setup = () =>
      render(
        <FolderViewBreadcrumb
          currentFolderId="folder-1"
          rootBreadcrumbPath={{ name: 'Sharings' }}
        />
      )

    it('navigates back to the active sharings tab root', () => {
      mockLocation.mockReturnValue({
        pathname: '/sharings/by-me/folder/folder-1',
        search: '?sort=name'
      })
      const { getByText } = setup()

      fireEvent.click(getByText('Sharings'))

      expect(mockNavigate).toHaveBeenCalledWith(
        { pathname: '../..', search: '?sort=name' },
        { relative: 'path' }
      )
    })

    it('uses the tab-scoped folder route for a parent folder', () => {
      mockLocation.mockReturnValue({
        pathname: '/sharings/by-me/folder/folder-1',
        search: '?sort=name'
      })
      const { getByText } = setup()

      fireEvent.click(getByText('Parent'))

      expect(mockNavigate).toHaveBeenCalledWith(
        { pathname: '../parent-1', search: '?sort=name' },
        { relative: 'path' }
      )
    })

    it('does not carry search params outside the sharings section', () => {
      mockLocation.mockReturnValue({
        pathname: '/folder/folder-1',
        search: '?foo=bar'
      })
      const { getByText } = setup()

      fireEvent.click(getByText('Parent'))

      expect(mockNavigate).toHaveBeenCalledWith(
        { pathname: '../parent-1', search: '' },
        { relative: 'path' }
      )
    })
  })
})
