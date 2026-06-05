import { render, screen } from '@testing-library/react'
import React from 'react'

const mockNavigate = jest.fn()
const mockUseParams = jest.fn()
const mockUseLocation = jest.fn()
const mockUseQuery = jest.fn()
const mockUseSharingContext = jest.fn()
const mockHasQueryBeenLoaded = jest.fn()
const mockIsOwner = jest.fn()
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
    allLoaded: sharingLoaded,
    isOwner: mockIsOwner
  })
  render(<FilesViewerSharedDriveRootFile />)
}

describe('FilesViewerSharedDriveRootFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsOwner.mockReturnValue(false)
  })

  it.each`
    label                     | fetchedFile                                                 | expectedOwnerId
    ${'canonical fetched id'} | ${{ _id: 'canonical-id', id: 'canonical-id', name: 'Doc' }} | ${'canonical-id'}
    ${'route fallback id'}    | ${{ id: 'partial', name: 'Doc' }}                           | ${'route-id'}
  `('asks isOwner about the $label', ({ fetchedFile, expectedOwnerId }) => {
    renderRootFileViewer({ fetchedFile })

    expect(mockIsOwner).toHaveBeenCalledWith(expectedOwnerId)
  })

  it.each`
    owner    | sharingDisabled
    ${false} | ${true}
    ${true}  | ${false}
  `(
    'forwards panel.sharing.disabled=$sharingDisabled when owner=$owner',
    ({ owner, sharingDisabled }) => {
      mockIsOwner.mockReturnValue(owner)

      renderRootFileViewer()

      expect(screen.getByText('files-viewer')).toBeInTheDocument()
      expect(mockFilesViewer).toHaveBeenCalledWith(
        expect.objectContaining({
          viewerProps: {
            panel: { sharing: { disabled: sharingDisabled } }
          }
        })
      )
    }
  )

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
