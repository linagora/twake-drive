import { render, screen } from '@testing-library/react'
import React from 'react'

const mockNavigate = jest.fn()
const mockUseParams = jest.fn()
const mockUseLocation = jest.fn()
const mockUseQuery = jest.fn()
const mockUseSharingContext = jest.fn()
const mockHasQueryBeenLoaded = jest.fn()
const mockFilesViewer = jest.fn(() => <div>files-viewer</div>)

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams()
}))

jest.mock('cozy-client', () => ({
  useQuery: (...args) => mockUseQuery(...args),
  hasQueryBeenLoaded: (...args) => mockHasQueryBeenLoaded(...args)
}))

jest.mock('cozy-sharing', () => ({
  useSharingContext: () => mockUseSharingContext()
}))

jest.mock('@/components/useHead', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@/components/FilesViewerLoading', () => ({
  FilesViewerLoading: () => <div>files-viewer-loading</div>
}))

jest.mock('@/modules/viewer/FilesViewer', () => ({
  __esModule: true,
  default: props => mockFilesViewer(props)
}))

jest.mock('@/queries', () => ({
  buildSharedDriveFileOrFolderByIdQuery: () => ({
    definition: jest.fn(),
    options: {}
  })
}))

import FilesViewerSharedDriveRootFile from './FilesViewerSharedDriveRootFile'

const renderRootFileViewer = ({
  fetchedFile = { _id: 'canonical-id', id: 'canonical-id', name: 'Doc' },
  queryStatus = 'loaded',
  queryLoaded = true,
  sharingLoaded = true,
  location = {
    pathname: '/sharings/drives/shareddrive/drive-1/file/route-id',
    state: undefined
  }
} = {}) => {
  mockUseParams.mockReturnValue({ driveId: 'drive-1', fileId: 'route-id' })
  mockUseLocation.mockReturnValue(location)
  mockUseQuery.mockReturnValue({
    data: fetchedFile,
    fetchStatus: queryStatus
  })
  mockHasQueryBeenLoaded.mockReturnValue(queryLoaded)
  mockUseSharingContext.mockReturnValue({
    allLoaded: sharingLoaded
  })
  render(<FilesViewerSharedDriveRootFile />)
}

describe('FilesViewerSharedDriveRootFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('disables the sharing panel', () => {
    renderRootFileViewer()

    expect(screen.getByText('files-viewer')).toBeInTheDocument()
    expect(mockFilesViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerProps: {
          panel: { sharing: { disabled: true } }
        }
      })
    )
  })

  it('closes a deep-linked viewer to the active sharings tab', () => {
    renderRootFileViewer()

    mockFilesViewer.mock.calls[0][0].onClose()

    expect(mockNavigate).toHaveBeenCalledWith('/sharings/drives')
  })

  it('changes files inside the active sharings tab', () => {
    renderRootFileViewer()

    mockFilesViewer.mock.calls[0][0].onChange('next-file-id')

    expect(mockNavigate).toHaveBeenCalledWith(
      '/sharings/drives/shareddrive/drive-1/file/next-file-id',
      { state: { fromPathname: '/sharings/drives' } }
    )
  })

  it('redirects to the active sharings tab when the file query fails', () => {
    renderRootFileViewer({
      fetchedFile: null,
      queryStatus: 'failed',
      queryLoaded: false,
      location: {
        pathname: '/sharings/drives/shareddrive/drive-1/file/route-id',
        state: undefined
      }
    })

    expect(mockNavigate).toHaveBeenCalledWith('/sharings/drives', {
      replace: true
    })
  })

  it('shows the loading state until everything is ready', () => {
    renderRootFileViewer({
      fetchedFile: null,
      queryStatus: 'loading',
      queryLoaded: false,
      sharingLoaded: false,
      location: {
        pathname: '/sharings/drives/shareddrive/drive-1/file/route-id',
        state: undefined
      }
    })

    expect(screen.getByText('files-viewer-loading')).toBeInTheDocument()
    expect(mockFilesViewer).not.toHaveBeenCalled()
  })
})
