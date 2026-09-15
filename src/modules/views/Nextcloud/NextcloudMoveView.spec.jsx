import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { NextcloudMoveView } from './NextcloudMoveView'

import { useNextcloudCurrentFolder } from '@/modules/nextcloud/hooks/useNextcloudCurrentFolder'
import { useNextcloudEntries } from '@/modules/nextcloud/hooks/useNextcloudEntries'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()
const mockUseSearchParams = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useSearchParams: () => mockUseSearchParams(),
  Navigate: ({ to, replace }) => (
    <div data-testid="navigate">{`to:${to},replace:${replace}`}</div>
  )
}))

jest.mock('@/modules/nextcloud/hooks/useNextcloudCurrentFolder', () => ({
  useNextcloudCurrentFolder: jest.fn()
}))

jest.mock('@/modules/nextcloud/hooks/useNextcloudEntries', () => ({
  useNextcloudEntries: jest.fn()
}))

jest.mock('@/components/LoaderModal', () => ({
  LoaderModal: () => <div data-testid="loader-modal">Loading</div>
}))

jest.mock('@/modules/move/MoveModal', () => ({
  __esModule: true,
  default: ({ onClose, showNextcloudFolder, entries, currentFolder }) => (
    <div data-testid="move-modal">
      <span data-testid="current-folder">{currentFolder.name}</span>
      <span data-testid="entries-count">{entries.length}</span>
      <span data-testid="show-nextcloud">{String(showNextcloudFolder)}</span>
      <button onClick={onClose}>Close modal</button>
    </div>
  )
}))

describe('NextcloudMoveView', () => {
  const currentFolder = {
    _id: 'nc-folder-1',
    _type: 'io.cozy.remote.nextcloud.files',
    name: 'NC Folder',
    path: '/NC Folder'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocation.mockReturnValue({ pathname: '/nextcloud/acc-1/move' })
    mockUseSearchParams.mockReturnValue([new URLSearchParams('path=/test')])
    useNextcloudCurrentFolder.mockReturnValue(currentFolder)
    useNextcloudEntries.mockReturnValue({
      hasEntries: true,
      isLoading: false,
      entries: [
        {
          _id: 'nc-file-1',
          _type: 'io.cozy.remote.nextcloud.files',
          name: 'NC File 1.txt',
          path: '/test/NC File 1.txt'
        }
      ]
    })
  })

  it('redirects to newPath when hasEntries is false', () => {
    useNextcloudEntries.mockReturnValue({
      hasEntries: false,
      isLoading: false,
      entries: []
    })
    render(<NextcloudMoveView />)

    expect(screen.getByTestId('navigate')).toHaveTextContent(
      'to:/nextcloud/acc-1?path=%2Ftest,replace:true'
    )
  })

  it('shows LoaderModal while loading', () => {
    useNextcloudEntries.mockReturnValue({
      hasEntries: true,
      isLoading: true,
      entries: null
    })
    render(<NextcloudMoveView />)

    expect(screen.getByTestId('loader-modal')).toBeInTheDocument()
  })

  it('renders MoveModal with currentFolder and entries', () => {
    render(<NextcloudMoveView />)

    expect(screen.getByTestId('move-modal')).toBeInTheDocument()
    expect(screen.getByTestId('current-folder')).toHaveTextContent('NC Folder')
    expect(screen.getByTestId('entries-count')).toHaveTextContent('1')
    expect(screen.getByTestId('show-nextcloud')).toHaveTextContent('true')
  })

  it('navigates to newPath on onClose', () => {
    render(<NextcloudMoveView />)

    fireEvent.click(screen.getByText('Close modal'))
    expect(mockNavigate).toHaveBeenCalledWith('/nextcloud/acc-1?path=%2Ftest', {
      replace: true
    })
  })
})
