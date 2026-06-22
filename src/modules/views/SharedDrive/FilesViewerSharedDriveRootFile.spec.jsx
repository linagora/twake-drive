import { render, screen } from '@testing-library/react'
import React from 'react'

const mockNavigate = jest.fn()
const mockUseParams = jest.fn()
const mockUseLocation = jest.fn()
const mockUseQuery = jest.fn()
const mockUseSharingContext = jest.fn()
const mockHasQueryBeenLoaded = jest.fn()
const mockFilesViewer = jest.fn(() => <div>files-viewer</div>)

const mockFindEditorForFile = jest.fn()

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams(),
  Navigate: ({ to }) => <div>{`navigate:${to}`}</div>
}))

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: () => ({ isDesktop: true })
}))

jest.mock('@/modules/views/editor/registry', () => ({
  findEditorForFile: (...args) => mockFindEditorForFile(...args)
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
    pathname: '/sharings/shareddrive/drive-1/file/route-id',
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
    mockFindEditorForFile.mockReturnValue(undefined)
  })

  it('redirects an editor document to its editor', () => {
    mockFindEditorForFile.mockReturnValue({
      slug: 'excalidraw',
      kind: 'editor',
      makeRoute: file => `/excalidraw/drive-1/${file._id}`
    })
    renderRootFileViewer({
      fetchedFile: {
        _id: 'canonical-id',
        id: 'canonical-id',
        name: 'Drawing.excalidraw'
      }
    })

    expect(
      screen.getByText('navigate:/excalidraw/drive-1/canonical-id')
    ).toBeInTheDocument()
    expect(mockFilesViewer).not.toHaveBeenCalled()
  })

  it('does not redirect a bridge document (it has no in-app route)', () => {
    mockFindEditorForFile.mockReturnValue({
      slug: 'grist',
      kind: 'bridge',
      makeRoute: file => `/bridge/grist/${file.metadata.externalId}`
    })
    renderRootFileViewer({
      fetchedFile: {
        _id: 'canonical-id',
        id: 'canonical-id',
        name: 'Budget.grist'
      }
    })

    expect(screen.getByText('files-viewer')).toBeInTheDocument()
  })

  it('renders the viewer when the file is not an editor document', () => {
    renderRootFileViewer()

    expect(screen.getByText('files-viewer')).toBeInTheDocument()
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

  it('redirects to /sharings when the file query fails', () => {
    renderRootFileViewer({
      fetchedFile: null,
      queryStatus: 'failed',
      queryLoaded: false,
      location: {
        pathname: '/sharings',
        state: undefined
      }
    })

    expect(mockNavigate).toHaveBeenCalledWith('/sharings', { replace: true })
  })

  it('shows the loading state until everything is ready', () => {
    renderRootFileViewer({
      fetchedFile: null,
      queryStatus: 'loading',
      queryLoaded: false,
      sharingLoaded: false,
      location: {
        pathname: '/sharings',
        state: undefined
      }
    })

    expect(screen.getByText('files-viewer-loading')).toBeInTheDocument()
    expect(mockFilesViewer).not.toHaveBeenCalled()
  })
})
