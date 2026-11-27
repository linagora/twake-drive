import { render, screen } from '@testing-library/react'
import React from 'react'

import CozyClient, { useQuery } from 'cozy-client'

import FilesViewer from './FilesViewer'
import AppLike from 'test/components/AppLike'
import { generateFile } from 'test/generate'

import { useCurrentFileId } from '@/hooks'
import {
  isOfficeEnabled,
  canOpenPdfWithOnlyOffice
} from '@/modules/views/OnlyOffice/helpers'

jest.mock('@/modules/views/OnlyOffice/helpers', () => ({
  ...jest.requireActual('@/modules/views/OnlyOffice/helpers'),
  isOfficeEnabled: jest.fn(() => true),
  canOpenPdfWithOnlyOffice: jest.fn(() => false)
}))

jest.mock('cozy-client/dist/hooks/useQuery', () => jest.fn())
jest.mock('lib/logger', () => ({
  error: jest.fn()
}))

jest.mock('hooks')

jest.mock('@/components/FilesRealTimeQueries', () => ({
  ...jest.requireActual('@/components/FilesRealTimeQueries'),
  ensureFileHasPath: jest.fn().mockImplementation(file => Promise.resolve(file))
}))

const mockViewer = jest.fn(() => <div>Viewer</div>)

jest.mock('cozy-viewer', () => ({
  ...jest.requireActual('cozy-viewer'),
  __esModule: true,
  default: props => mockViewer(props)
}))

const sleep = duration => new Promise(resolve => setTimeout(resolve, duration))

describe('FilesViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const setup = ({
    fileId = 'file-foobar0',
    nbFiles = 3,
    totalCount,
    client = new CozyClient({}),
    useQueryResultAttributes,
    viewerProps,
    files
  } = {}) => {
    const filesFixture =
      files ??
      Array(nbFiles)
        .fill(null)
        .map((x, i) => generateFile({ i, type: 'file' }))
    const mockedUseQueryReturnedValues = {
      data: filesFixture,
      count: totalCount || filesFixture.length,
      fetchMore: jest.fn().mockImplementation(() => {
        throw new Error('Fetch more should not be called')
      }),
      ...useQueryResultAttributes
    }
    useQuery.mockReturnValue(mockedUseQueryReturnedValues)

    useCurrentFileId.mockReturnValue(fileId)

    return render(
      <AppLike client={client}>
        <FilesViewer
          files={filesFixture}
          filesQuery={mockedUseQueryReturnedValues}
          viewerProps={viewerProps}
        />
      </AppLike>
    )
  }

  it('should render a Viewer', async () => {
    setup()

    const viewer = await screen.findByText('Viewer')
    expect(viewer).toBeInTheDocument()
  })

  it('forwards disabled sharing actions to the viewer', async () => {
    setup({
      viewerProps: {
        panel: {
          sharing: { disabled: true }
        }
      }
    })

    await screen.findByText('Viewer')

    expect(mockViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        componentsProps: expect.objectContaining({
          panel: {
            sharing: { disabled: true }
          },
          sharingActions: {
            disabled: true
          }
        })
      })
    )
  })

  it('keeps its toolbar props when given more', async () => {
    const onFilePathClick = jest.fn()
    setup({ viewerProps: { toolbarProps: { onFilePathClick } } })

    await screen.findByText('Viewer')

    expect(mockViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        componentsProps: expect.objectContaining({
          toolbarProps: expect.objectContaining({
            showFilePath: true,
            onFilePathClick
          })
        })
      })
    )
  })

  it('should fetch the file if necessary', async () => {
    const client = new CozyClient({})
    client.query = jest.fn().mockResolvedValue({
      data: generateFile({ i: '51' })
    })

    setup({
      client,
      nbFiles: 50,
      totalCount: 100,
      fileId: 'file-foobar51'
    })

    const viewer = await screen.findByText('Viewer')
    expect(viewer).toBeInTheDocument()
    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'file-foobar51',
        doctype: 'io.cozy.files'
      })
    )
  })

  it('should call ensureFileHasPath when fetching file', async () => {
    const client = new CozyClient({})
    const fileData = generateFile({ i: '51' })
    const fileWithPath = { ...fileData, path: '/test/path' }

    client.query = jest.fn().mockResolvedValue({
      data: fileData
    })

    const { ensureFileHasPath } = require('@/components/FilesRealTimeQueries')
    ensureFileHasPath.mockResolvedValue(fileWithPath)

    setup({
      client,
      nbFiles: 50,
      totalCount: 100,
      fileId: 'file-foobar51'
    })

    const viewer = await screen.findByText('Viewer')
    expect(viewer).toBeInTheDocument()
    expect(ensureFileHasPath).toHaveBeenCalledWith(fileData, client)
    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'file-foobar51',
        doctype: 'io.cozy.files'
      })
    )
  })

  it('should fetch more files if necessary', async () => {
    const client = new CozyClient({})
    client.query = jest.fn().mockResolvedValue({
      data: generateFile({ i: '51' })
    })
    const fetchMore = jest.fn().mockImplementation(async () => {
      await sleep(50)
    })

    const hasMore = jest.fn().mockReturnValue(true)

    setup({
      client,
      nbFiles: 50,
      totalCount: 100,
      fileId: 'file-foobar48',
      useQueryResultAttributes: {
        fetchMore,
        hasMore
      }
    })

    const viewer = await screen.findByText('Viewer')
    expect(viewer).toBeInTheDocument()
    expect(fetchMore).toHaveBeenCalledTimes(1)
  })

  it('disables OnlyOffice as PDF editor when PDF editing flag is off while keeping office enabled for other formats', async () => {
    isOfficeEnabled.mockReturnValue(true)
    canOpenPdfWithOnlyOffice.mockReturnValue(false)

    setup()

    await screen.findByText('Viewer')
    const { componentsProps } = mockViewer.mock.calls[0][0]
    expect(componentsProps.PdfViewer.isPdfEditorEnabled).toBe(false)
    expect(componentsProps.OnlyOfficeViewer.isEnabled).toBe(true)
  })

  it('never offers OnlyOffice for a note, even without its mime', async () => {
    isOfficeEnabled.mockReturnValue(true)
    const note = {
      ...generateFile({ i: 0, type: 'file' }),
      class: 'text',
      mime: undefined,
      name: 'Journal.cozy-note'
    }

    setup({ files: [note], fileId: note._id })

    await screen.findByText('Viewer')
    const { componentsProps } = mockViewer.mock.calls[0][0]
    expect(componentsProps.OnlyOfficeViewer.isEnabled).toBe(false)
  })

  it('enables OnlyOffice as PDF editor when PDF editing flag is explicitly on', async () => {
    isOfficeEnabled.mockReturnValue(true)
    canOpenPdfWithOnlyOffice.mockReturnValue(true)

    setup()

    await screen.findByText('Viewer')
    const { componentsProps } = mockViewer.mock.calls[0][0]
    expect(componentsProps.PdfViewer.isPdfEditorEnabled).toBe(true)
    expect(componentsProps.OnlyOfficeViewer.isEnabled).toBe(true)
  })
})
