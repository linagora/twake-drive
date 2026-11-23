import { render, screen } from '@testing-library/react'
import React from 'react'

import { useClient, useQuery } from 'cozy-client'
import flag from 'cozy-flags'

import FilesViewerRecent from './FilesViewerRecent'

const mockFilesViewer = jest.fn(() => <div>files-viewer</div>)
const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn(),
  useQuery: jest.fn()
}))

jest.mock('cozy-flags', () => ({ __esModule: true, default: jest.fn() }))

jest.mock('@/components/useHead', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@/components/FilesViewerLoading', () => ({
  FilesViewerLoading: () => <div>viewer-loading</div>
}))

jest.mock('@/modules/viewer/FilesViewer', () => ({
  __esModule: true,
  default: props => mockFilesViewer(props)
}))

const makeFile = (id, attributes = {}) => ({
  _id: id,
  _type: 'io.cozy.files',
  type: 'file',
  name: `${id}.txt`,
  ...attributes
})

const localFile = makeFile('local')
const driveFile = makeFile('drive', { driveId: 'drive-1', dir_id: 'dir-1' })
const folder = makeFile('folder', { type: 'directory', name: 'Projects' })
const trashedFile = makeFile('trashed', { trashed: true })

const recentOf = file => ({
  _id: file._id,
  _type: 'io.cozy.files.recents',
  type: file.type,
  name: file.name,
  file: { data: file }
})

const unreadable = {
  _id: 'gone',
  _type: 'io.cozy.files.recents',
  type: 'file',
  name: 'gone.txt',
  file: { data: null }
}

const mockQueries = ({
  recents = [],
  fetchStatus = 'loaded',
  lastUpdate = 1,
  localRecents = []
} = {}) => {
  useQuery.mockImplementation((definition, { as }) =>
    as === 'io.cozy.files.recents'
      ? {
          data: recents,
          fetchStatus,
          lastUpdate,
          hasMore: false,
          fetchMore: jest.fn()
        }
      : { data: localRecents, fetchStatus: 'loaded' }
  )
  useClient.mockReturnValue({ getQueryFromState: () => null })
}

const viewerProps = () => mockFilesViewer.mock.calls.at(-1)[0]

describe('FilesViewerRecent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('with the personal recents', () => {
    beforeEach(() => {
      flag.mockImplementation(name => name === 'drive.recents.enabled')
    })

    it('browses the readable files of the recents, in their order', () => {
      mockQueries({
        recents: [
          recentOf(driveFile),
          recentOf(folder),
          unreadable,
          recentOf(trashedFile),
          recentOf(localFile)
        ]
      })

      render(<FilesViewerRecent />)

      expect(viewerProps().files).toEqual([driveFile, localFile])
      expect(viewerProps().filesQuery.data).toEqual([driveFile, localFile])
    })

    it('stays in the Recent viewer when it closes or changes file', () => {
      mockQueries({ recents: [recentOf(driveFile), recentOf(localFile)] })

      render(<FilesViewerRecent />)

      viewerProps().onClose()
      expect(mockNavigate).toHaveBeenCalledWith('/recent')

      viewerProps().onChange('drive')
      expect(mockNavigate).toHaveBeenCalledWith('/recent/file/drive')
    })

    it('shows the loading viewer until a page of recents is loaded', () => {
      mockQueries({ fetchStatus: 'loading', lastUpdate: null })

      render(<FilesViewerRecent />)

      expect(screen.queryByText('viewer-loading')).toBeInTheDocument()
      expect(mockFilesViewer).not.toHaveBeenCalled()
    })

    it('keeps the viewer while more recents load', () => {
      mockQueries({
        recents: [recentOf(localFile)],
        fetchStatus: 'loading',
        lastUpdate: 1
      })

      render(<FilesViewerRecent />)

      expect(screen.queryByText('viewer-loading')).toBe(null)
      expect(viewerProps().files).toEqual([localFile])
    })
  })

  describe('without the personal recents', () => {
    beforeEach(() => {
      flag.mockReturnValue(false)
    })

    it('browses the local recent files', () => {
      mockQueries({ recents: [recentOf(driveFile)], localRecents: [localFile] })

      render(<FilesViewerRecent />)

      expect(viewerProps().files).toEqual([localFile])
      expect(
        useQuery.mock.calls.some(([, { as }]) => as === 'io.cozy.files.recents')
      ).toBe(false)
    })
  })
})
