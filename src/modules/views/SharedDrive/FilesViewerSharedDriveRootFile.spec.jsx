import { render, screen } from '@testing-library/react'
import React from 'react'

import flag from 'cozy-flags'

const mockNavigate = jest.fn()
const mockUseParams = jest.fn()
const mockUseLocation = jest.fn()
const mockUseQuery = jest.fn()
const mockUseSharingContext = jest.fn()
const mockHasQueryBeenLoaded = jest.fn()
const mockFilesViewer = jest.fn(() => <div>files-viewer</div>)
const mockNavigateElement = jest.fn(() => <div>navigate</div>)
const mockFindEditorForFile = jest.fn()

jest.mock('react-router-dom', () => ({
  Navigate: props => mockNavigateElement(props),
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

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: () => ({ isDesktop: true })
}))

jest.mock('@/modules/views/editor/registry', () => ({
  findEditorForFile: (...args) => mockFindEditorForFile(...args)
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

import { makeOnlyOfficeFileRoute } from '@/modules/views/OnlyOffice/helpers'

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
    mockFindEditorForFile.mockImplementation(
      jest.requireActual('@/modules/views/editor/registry').findEditorForFile
    )
  })

  it('redirects an editor document to its editor', () => {
    mockFindEditorForFile.mockReturnValue({
      slug: 'excalidraw',
      makeRoute: fileId => `/excalidraw/drive-1/${fileId}`
    })
    renderRootFileViewer({
      fetchedFile: {
        _id: 'canonical-id',
        id: 'canonical-id',
        name: 'Drawing.excalidraw'
      }
    })

    expect(mockNavigateElement).toHaveBeenCalledWith({
      to: '/excalidraw/drive-1/canonical-id',
      replace: true
    })
    expect(mockFilesViewer).not.toHaveBeenCalled()
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

    expect(mockNavigateElement).toHaveBeenCalledWith({
      to: '/sharings/drives',
      replace: true
    })
    expect(mockFilesViewer).not.toHaveBeenCalled()
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

  describe('office routing', () => {
    const pdf = {
      _id: 'canonical-id',
      id: 'canonical-id',
      type: 'file',
      class: 'pdf',
      name: 'document.pdf'
    }
    const deck = {
      _id: 'canonical-id',
      id: 'canonical-id',
      type: 'file',
      class: 'slide',
      name: 'deck.pptx'
    }

    it('opens the editor instead of the viewer when the registry claims it', () => {
      mockFindEditorForFile.mockReturnValue({
        slug: 'onlyoffice',
        makeRoute: makeOnlyOfficeFileRoute
      })

      renderRootFileViewer({ fetchedFile: deck })

      expect(mockFindEditorForFile).toHaveBeenCalledWith(deck, {
        isDesktop: true
      })
      expect(mockNavigateElement).toHaveBeenCalledWith({
        to: '/onlyoffice/drive-1/canonical-id?redirectLink=drive%23%2Fsharings%2Fdrives',
        replace: true
      })
      expect(mockFilesViewer).not.toHaveBeenCalled()
    })

    it('keeps the viewer when the registry does not claim it', () => {
      renderRootFileViewer({ fetchedFile: deck })

      expect(mockFindEditorForFile).toHaveBeenCalledWith(deck, {
        isDesktop: true
      })
      expect(mockNavigateElement).not.toHaveBeenCalled()
      expect(screen.getByText('files-viewer')).toBeInTheDocument()
    })

    it('opens a deep-linked PDF in OnlyOffice when office and PDF editing are enabled', () => {
      flag.mockImplementation(
        name =>
          name === 'drive.office.enabled' ||
          name === 'drive.onlyoffice.pdf-editing.enabled'
      )

      renderRootFileViewer({ fetchedFile: pdf })

      expect(screen.getByText('navigate')).toBeInTheDocument()
      expect(mockNavigateElement).toHaveBeenCalledWith({
        to: '/onlyoffice/drive-1/canonical-id?redirectLink=drive%23%2Fsharings%2Fdrives',
        replace: true
      })
      expect(screen.queryByText('files-viewer')).toBe(null)
    })

    it('keeps the PDF viewer when PDF editing is disabled even with office enabled', () => {
      flag.mockImplementation(name => name === 'drive.office.enabled')

      renderRootFileViewer({ fetchedFile: pdf })

      expect(screen.getByText('files-viewer')).toBeInTheDocument()
      expect(screen.queryByText('navigate')).toBe(null)
    })

    it('opens non-PDF office files in OnlyOffice even when PDF editing is disabled', () => {
      flag.mockImplementation(name => name === 'drive.office.enabled')

      renderRootFileViewer({ fetchedFile: deck })

      expect(screen.getByText('navigate')).toBeInTheDocument()
      expect(mockNavigateElement).toHaveBeenCalledWith({
        to: '/onlyoffice/drive-1/canonical-id?redirectLink=drive%23%2Fsharings%2Fdrives',
        replace: true
      })
      expect(screen.queryByText('files-viewer')).toBe(null)
    })

    it('keeps the PDF viewer when office is disabled', () => {
      flag.mockReturnValue(false)

      renderRootFileViewer({ fetchedFile: pdf })

      expect(screen.getByText('files-viewer')).toBeInTheDocument()
      expect(screen.queryByText('navigate')).toBe(null)
    })
  })
})
