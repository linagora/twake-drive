import { render } from '@testing-library/react'
import React from 'react'

import FilesViewerSharedDrive from './FilesViewerSharedDrive'

const mockFilesViewer = jest.fn(() => <div>files-viewer</div>)
const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()
const mockUseParams = jest.fn()
const mockUseQuery = jest.fn()

jest.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams()
}))

jest.mock('cozy-client', () => ({
  useQuery: (...args) => mockUseQuery(...args)
}))

jest.mock('cozy-sharing', () => ({
  useSharingContext: () => ({
    hasWriteAccess: jest.fn(() => true)
  })
}))

jest.mock('@/components/useHead', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@/hooks', () => ({
  useCurrentFolderId: () => 'folder-1',
  useFolderSort: () => [{ attribute: 'name', order: 'asc' }]
}))

jest.mock('@/modules/viewer/FilesViewer', () => ({
  __esModule: true,
  default: props => mockFilesViewer(props)
}))

jest.mock('@/queries', () => ({
  buildSharedDriveQuery: () => ({
    definition: jest.fn(),
    options: {}
  })
}))

describe('FilesViewerSharedDrive', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ driveId: 'drive-1' })
    mockUseQuery.mockReturnValue({ data: [{ _id: 'file-1' }] })
  })

  it('navigates within the active sharings tab', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/sharings/with-me/shareddrive/drive-1/folder-1/file/file-1'
    })

    render(<FilesViewerSharedDrive />)

    mockFilesViewer.mock.calls[0][0].onClose()
    expect(mockNavigate).toHaveBeenCalledWith(
      '/sharings/with-me/shareddrive/drive-1/folder-1'
    )

    mockFilesViewer.mock.calls[0][0].onChange('file-2')
    expect(mockNavigate).toHaveBeenCalledWith(
      '/sharings/with-me/shareddrive/drive-1/folder-1/file/file-2'
    )
  })

  it('keeps direct shared-drive routes outside sharings', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/shareddrive/drive-1/folder-1/file/file-1'
    })

    render(<FilesViewerSharedDrive />)

    mockFilesViewer.mock.calls[0][0].onClose()
    expect(mockNavigate).toHaveBeenCalledWith('/shareddrive/drive-1/folder-1')
  })
})
