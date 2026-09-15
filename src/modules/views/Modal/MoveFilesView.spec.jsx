import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'

import { MoveFilesView } from './MoveFilesView'

import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  Navigate: ({ to, replace }) => (
    <div data-testid="navigate">{`to:${to},replace:${replace}`}</div>
  )
}))

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  hasQueryBeenLoaded: jest.fn(),
  useQuery: jest.fn()
}))

jest.mock('@/hooks/useDisplayedFolder', () => jest.fn())
jest.mock('@/modules/shareddrives/hooks/useSharedDrives', () => ({
  useSharedDrives: jest.fn()
}))

jest.mock('@/components/LoaderModal', () => ({
  LoaderModal: () => <div data-testid="loader-modal">Loading</div>
}))

jest.mock('@/modules/move/MoveModal', () => ({
  __esModule: true,
  default: ({
    onClose,
    onMovingSuccess,
    showNextcloudFolder,
    showSharedDriveFolder,
    entries,
    currentFolder
  }) => (
    <div data-testid="move-modal">
      <span data-testid="current-folder">{currentFolder.name}</span>
      <span data-testid="entries-count">{entries.length}</span>
      <span data-testid="show-nextcloud">{String(showNextcloudFolder)}</span>
      <span data-testid="show-shared-drive">
        {String(showSharedDriveFolder)}
      </span>
      <button onClick={onClose}>Close modal</button>
      <button onClick={onMovingSuccess}>Success modal</button>
    </div>
  )
}))

describe('MoveFilesView', () => {
  const displayedFolder = {
    _id: 'folder-1',
    name: 'Folder 1',
    path: '/Folder 1'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useDisplayedFolder.mockReturnValue({ displayedFolder })
    useSharedDrives.mockReturnValue({ sharedDrives: [{ id: 'drive-1' }] })
    hasQueryBeenLoaded.mockReturnValue(true)
    mockUseLocation.mockReturnValue({
      state: { fileIds: ['file-1', 'file-2'] }
    })
    useQuery.mockReturnValue({
      data: [
        { _id: 'file-1', name: 'File 1.pdf', type: 'file' },
        { _id: 'file-2', name: 'File 2.pdf', type: 'file' }
      ]
    })
  })

  it('redirects to .. when state has no fileIds', () => {
    mockUseLocation.mockReturnValue({ state: null })
    render(<MoveFilesView />)

    expect(screen.getByTestId('navigate')).toHaveTextContent(
      'to:..,replace:true'
    )
  })

  it('shows LoaderModal when query is not loaded', () => {
    hasQueryBeenLoaded.mockReturnValue(false)
    render(<MoveFilesView />)

    expect(screen.getByTestId('loader-modal')).toBeInTheDocument()
  })

  it('renders MoveModal with correct props in folder context', () => {
    render(<MoveFilesView />)

    expect(screen.getByTestId('move-modal')).toBeInTheDocument()
    expect(screen.getByTestId('current-folder')).toHaveTextContent('Folder 1')
    expect(screen.getByTestId('entries-count')).toHaveTextContent('2')
    expect(screen.getByTestId('show-nextcloud')).toHaveTextContent('true')
    expect(screen.getByTestId('show-shared-drive')).toHaveTextContent('true')
  })

  it('disables showNextcloudFolder when entries contain a directory', () => {
    useQuery.mockReturnValue({
      data: [
        { _id: 'folder-child', name: 'Child', type: 'directory' },
        { _id: 'file-1', name: 'File 1.pdf', type: 'file' }
      ]
    })
    render(<MoveFilesView />)

    expect(screen.getByTestId('show-nextcloud')).toHaveTextContent('false')
  })

  it('navigates to .. on onClose', () => {
    render(<MoveFilesView />)

    fireEvent.click(screen.getByText('Close modal'))
    expect(mockNavigate).toHaveBeenCalledWith('..', { replace: true })
  })

  it('navigates to .. on onMovingSuccess when not in viewer', () => {
    render(<MoveFilesView isOpenInViewer={false} />)

    fireEvent.click(screen.getByText('Success modal'))
    expect(mockNavigate).toHaveBeenCalledWith('..', { replace: true })
  })

  it('navigates to ../.. on onMovingSuccess when in viewer', () => {
    render(<MoveFilesView isOpenInViewer={true} />)

    fireEvent.click(screen.getByText('Success modal'))
    expect(mockNavigate).toHaveBeenCalledWith('../..', { replace: true })
  })

  it('navigates to .. on onClose even when in viewer to stay in viewer after cancelling', () => {
    render(<MoveFilesView isOpenInViewer={true} />)

    fireEvent.click(screen.getByText('Close modal'))
    expect(mockNavigate).toHaveBeenCalledWith('..', { replace: true })
  })
})
