import { render } from '@testing-library/react'
import React from 'react'

jest.mock('react-router-dom', () => ({
  Outlet: () => null
}))

jest.mock('cozy-flags', () => ({
  __esModule: true,
  default: () => false
}))

jest.mock('@/modules/drive/AddMenu/AddMenuProvider', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/drive/FabWithAddMenuContext', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('@/modules/drive/Toolbar', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('@/modules/shareddrives/components/SharedDriveBreadcrumb', () => ({
  SharedDriveBreadcrumb: () => null
}))

jest.mock('@/modules/shareddrives/components/SharedDriveFolderBody', () => ({
  SharedDriveFolderBody: () => null
}))

jest.mock('@/modules/upload/Dropzone', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/upload/DropzoneDnD', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/views/Folder/FolderViewHeader', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/views/Folder/virtualized/FolderViewBody', () => ({
  __esModule: true,
  default: () => null
}))

import { SharedDriveFolderContent } from './SharedDriveFolderContent'

const baseProps = {
  actions: [],
  queryResults: [{ fetchStatus: 'loaded', data: [], hasMore: false }],
  folderId: 'folder-1',
  displayedFolder: null,
  canWriteToCurrentFolder: false,
  driveId: 'drive-1',
  isInRootOfSharedDrive: false,
  sortOrder: { attribute: 'name', order: 'asc' },
  setSortOrder: jest.fn(),
  isSettingsLoaded: true,
  isFabDisplayed: false,
  refresh: jest.fn(),
  isSelectionBarVisible: false,
  isMobile: false
}

describe('SharedDriveFolderContent', () => {
  it('renders without errors', () => {
    render(<SharedDriveFolderContent {...baseProps} />)
  })

  it('renders Fab when isFabDisplayed is true', () => {
    render(<SharedDriveFolderContent {...baseProps} isFabDisplayed={true} />)
  })
})
