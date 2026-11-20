import { render, screen } from '@testing-library/react'
import React from 'react'
import { useParams } from 'react-router-dom'

import { createMockClient, useQuery } from 'cozy-client'

import { SharedDriveFolderView } from './SharedDriveFolderView'
import AppLike from 'test/components/AppLike'

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn()
}))
jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))
jest.mock('@/components/useHead', () => jest.fn())
jest.mock('@/hooks', () => ({
  ...jest.requireActual('@/hooks'),
  useDisplayedFolder: () => ({ displayedFolder: { _id: 'folder-1' } })
}))
jest.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn()
}))
jest.mock('@/modules/shareddrives/hooks/useSharedDriveFolder', () => ({
  useSharedDriveFolder: jest.fn()
}))
jest.mock('@/modules/shareddrives/components/SharedDriveBreadcrumb', () => ({
  SharedDriveBreadcrumb: () => null
}))
jest.mock('@/modules/shareddrives/components/SharedDriveFolderBody', () => ({
  SharedDriveFolderBody: () => <div data-testid="shared-drive-content" />
}))
jest.mock('@/modules/drive/Toolbar', () => ({ showShareButton, canUpload }) => (
  <>
    {showShareButton ? <button>Share</button> : null}
    {canUpload ? <button>Upload</button> : null}
  </>
))
jest.mock(
  '@/modules/upload/Dropzone',
  () =>
    ({ children }) =>
      children
)
jest.mock(
  '@/modules/views/Folder/FolderView',
  () =>
    ({ children, isNotFound }) =>
      isNotFound ? <div data-testid="sharing-not-found" /> : children
)
jest.mock('@/modules/filelist/FileListRowsPlaceholder', () => () => (
  <div data-testid="sharing-loading" />
))

const sharing = { _id: 'drive-1', rules: [{ values: ['folder-1'] }] }

function Wrapper({ children }) {
  return <AppLike client={createMockClient({})}>{children}</AppLike>
}

describe('SharedDriveFolderView', () => {
  beforeEach(() => {
    useParams.mockReturnValue({ driveId: 'drive-1', folderId: 'folder-1' })
    useQuery.mockReturnValue({
      fetchStatus: 'loaded',
      lastFetch: Date.now(),
      data: sharing
    })
    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: { included: [] },
      fetchStatus: 'loaded'
    })
  })

  it('waits for the sharing before mounting the folder and its share button', () => {
    useQuery.mockReturnValue({ fetchStatus: 'loading', data: null })
    const { rerender } = render(<SharedDriveFolderView />, {
      wrapper: Wrapper
    })

    expect(screen.queryByTestId('sharing-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('shared-drive-content')).toBe(null)
    expect(screen.queryByRole('button', { name: 'Share' })).toBe(null)
    expect(useSharedDriveFolder).not.toHaveBeenCalled()

    useQuery.mockReturnValue({
      fetchStatus: 'loaded',
      lastFetch: Date.now(),
      data: sharing
    })
    rerender(<SharedDriveFolderView />)

    expect(screen.queryByTestId('sharing-loading')).toBe(null)
    expect(screen.queryByTestId('shared-drive-content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeInTheDocument()
  })

  it('keeps a loaded folder visible during a background sharing refresh', () => {
    useQuery.mockReturnValue({
      fetchStatus: 'loading',
      lastFetch: Date.now(),
      data: sharing
    })

    render(<SharedDriveFolderView />, { wrapper: Wrapper })

    expect(screen.queryByTestId('sharing-loading')).toBe(null)
    expect(screen.queryByTestId('shared-drive-content')).toBeInTheDocument()
  })

  it('offers no upload in a folder that cannot be loaded', () => {
    const WriterWrapper = ({ children }) => (
      <AppLike
        client={createMockClient({})}
        sharingContextValue={{
          hasWriteAccess: () => true,
          getRecipients: () => [],
          isOwner: () => false,
          refresh: jest.fn(),
          allLoaded: true
        }}
      >
        {children}
      </AppLike>
    )
    render(<SharedDriveFolderView />, { wrapper: WriterWrapper })
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeInTheDocument()

    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: { included: [] },
      fetchStatus: 'failed'
    })
    render(<SharedDriveFolderView />, { wrapper: WriterWrapper })

    expect(screen.getAllByRole('button', { name: 'Upload' })).toHaveLength(1)
  })

  it('lets F2 follow the Rename rule of its menu for a reader', () => {
    const ReaderWrapper = ({ children }) => (
      <AppLike
        client={createMockClient({})}
        sharingContextValue={{
          hasWriteAccess: () => false,
          getRecipients: () => [],
          isOwner: () => false,
          refresh: jest.fn(),
          allLoaded: true
        }}
      >
        {children}
      </AppLike>
    )
    render(<SharedDriveFolderView />, { wrapper: ReaderWrapper })

    const { actions } = useKeyboardShortcuts.mock.calls.at(-1)[0]
    const { rename } = actions.find(action => 'rename' in action)
    expect(
      rename.displayCondition([{ _id: 'file-1', type: 'file' }])
    ).toBeFalsy()
  })

  it('does not show the root share button in a subfolder', () => {
    useParams.mockReturnValue({ driveId: 'drive-1', folderId: 'subfolder-1' })

    render(<SharedDriveFolderView />, { wrapper: Wrapper })

    expect(screen.queryByTestId('shared-drive-content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).toBe(null)
  })

  it('shows the folder error when the sharing query fails', () => {
    useQuery.mockReturnValue({ fetchStatus: 'failed', data: null })

    render(<SharedDriveFolderView />, { wrapper: Wrapper })

    expect(
      screen.queryByRole('button', { name: 'Refresh now' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('sharing-loading')).toBe(null)
    expect(useSharedDriveFolder).not.toHaveBeenCalled()
  })

  it('shows not found when the loaded sharing is missing', () => {
    useQuery.mockReturnValue({
      fetchStatus: 'loaded',
      lastFetch: Date.now(),
      data: null
    })

    render(<SharedDriveFolderView />, { wrapper: Wrapper })

    expect(screen.queryByTestId('sharing-not-found')).toBeInTheDocument()
    expect(useSharedDriveFolder).not.toHaveBeenCalled()
  })
})
