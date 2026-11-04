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
const mockIsOfficeEnabled = jest.fn(() => false)

jest.mock('react-router-dom', () => ({
  Navigate: props => mockNavigateElement(props),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams()
}))

jest.mock('cozy-client', () => ({
  generateWebLink: jest.requireActual('cozy-client').generateWebLink,
  useClient: () => ({
    getStackClient: () => ({ uri: 'https://bob.cozy.example' }),
    getInstanceOptions: () => ({ subdomain: 'flat' })
  }),
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

jest.mock('@/modules/views/OnlyOffice/helpers', () => ({
  ...jest.requireActual('@/modules/views/OnlyOffice/helpers'),
  isOfficeEnabled: () => mockIsOfficeEnabled()
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

  describe('note routing', () => {
    const note = {
      _id: 'canonical-id',
      id: 'canonical-id',
      type: 'file',
      class: 'text',
      mime: 'text/vnd.cozy.note+markdown',
      name: 'Meeting.cozy-note',
      metadata: { title: 'Meeting', version: 12 }
    }

    it('opens a note in the Notes app instead of the viewer', () => {
      renderRootFileViewer({ fetchedFile: note })

      expect(screen.getByText('navigate')).toBeInTheDocument()
      expect(mockNavigateElement).toHaveBeenCalledWith({
        to: `/note/drive-1/canonical-id?returnUrl=${encodeURIComponent(
          'https://bob-drive.cozy.example/#/sharings/drives'
        )}`,
        replace: true
      })
      expect(screen.queryByText('files-viewer')).toBe(null)
    })

    it('returns from the Notes app to the page the note was opened from', () => {
      renderRootFileViewer({
        fetchedFile: note,
        location: {
          pathname: '/sharings/with-me/shareddrive/drive-1/file/route-id',
          state: { fromPathname: '/sharings/with-me' }
        }
      })

      expect(mockNavigateElement).toHaveBeenCalledWith({
        to: `/note/drive-1/canonical-id?returnUrl=${encodeURIComponent(
          'https://bob-drive.cozy.example/#/sharings/with-me'
        )}`,
        replace: true
      })
    })

    it('opens a note in the Notes app even when office is enabled', () => {
      mockIsOfficeEnabled.mockReturnValue(true)

      renderRootFileViewer({ fetchedFile: note })

      expect(mockNavigateElement).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringMatching(/^\/note\/drive-1\/canonical-id\?/)
        })
      )
      expect(screen.queryByText('files-viewer')).toBe(null)
    })
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

    it('opens the editor instead of the viewer when office is enabled', () => {
      mockIsOfficeEnabled.mockReturnValue(true)

      renderRootFileViewer({ fetchedFile: deck })

      expect(mockNavigateElement).toHaveBeenCalledWith({
        to: '/onlyoffice/drive-1/canonical-id?redirectLink=drive%23%2Fsharings%2Fdrives',
        replace: true
      })
      expect(mockFilesViewer).not.toHaveBeenCalled()
    })

    it('keeps the viewer when office is disabled', () => {
      mockIsOfficeEnabled.mockReturnValue(false)

      renderRootFileViewer({ fetchedFile: deck })

      expect(mockNavigateElement).not.toHaveBeenCalled()
      expect(screen.getByText('files-viewer')).toBeInTheDocument()
    })

    it('opens a deep-linked PDF in OnlyOffice when office and PDF editing are enabled', () => {
      mockIsOfficeEnabled.mockReturnValue(true)
      flag.mockImplementation(
        name => name === 'drive.onlyoffice.pdf-editing.enabled'
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
      mockIsOfficeEnabled.mockReturnValue(true)
      flag.mockReturnValue(false)

      renderRootFileViewer({ fetchedFile: pdf })

      expect(screen.getByText('files-viewer')).toBeInTheDocument()
      expect(screen.queryByText('navigate')).toBe(null)
    })

    it('opens non-PDF office files in OnlyOffice even when PDF editing is disabled', () => {
      mockIsOfficeEnabled.mockReturnValue(true)
      flag.mockReturnValue(false)

      renderRootFileViewer({ fetchedFile: deck })

      expect(screen.getByText('navigate')).toBeInTheDocument()
      expect(mockNavigateElement).toHaveBeenCalledWith({
        to: '/onlyoffice/drive-1/canonical-id?redirectLink=drive%23%2Fsharings%2Fdrives',
        replace: true
      })
      expect(screen.queryByText('files-viewer')).toBe(null)
    })

    it('keeps the PDF viewer when office is disabled', () => {
      mockIsOfficeEnabled.mockReturnValue(false)
      flag.mockReturnValue(false)

      renderRootFileViewer({ fetchedFile: pdf })

      expect(screen.getByText('files-viewer')).toBeInTheDocument()
      expect(screen.queryByText('navigate')).toBe(null)
    })
  })
})
