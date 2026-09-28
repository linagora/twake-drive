import { createMockClient, models } from 'cozy-client'

import { indexFiles, makeNormalizedFile, TYPE_DIRECTORY } from './helpers'

models.note.fetchURL = jest.fn(() => 'noteUrl')
models.file.shouldBeOpenedByOnlyOffice = jest.fn(() => false)

const client = createMockClient({})

const noteFileProps = {
  name: 'note.cozy-note',
  metadata: {
    content: '',
    schema: '',
    title: '',
    version: ''
  }
}

describe('makeNormalizedFile', () => {
  beforeEach(() => {
    models.file.shouldBeOpenedByOnlyOffice = jest.fn(() => false)
  })

  it('should return correct values for a directory', () => {
    const folders = []
    const file = {
      _id: 'fileId',
      type: TYPE_DIRECTORY,
      path: 'filePath',
      name: 'fileName'
    }

    const normalizedFile = makeNormalizedFile(client, folders, file)

    expect(normalizedFile).toEqual({
      id: 'fileId',
      name: 'fileName',
      path: 'filePath',
      url: '/folder/fileId',
      parentUrl: '/folder/fileId',
      openOn: 'drive',
      mime: undefined,
      type: 'directory'
    })
  })

  it('should return correct values for a file', () => {
    const folders = [{ _id: 'folderId', path: 'folderPath' }]
    const file = {
      _id: 'fileId',
      dir_id: 'folderId',
      type: 'file',
      name: 'fileName'
    }

    const normalizedFile = makeNormalizedFile(client, folders, file)

    expect(normalizedFile).toEqual({
      id: 'fileId',
      name: 'fileName',
      path: 'folderPath',
      url: '/folder/folderId/file/fileId',
      parentUrl: '/folder/folderId',
      openOn: 'drive',
      mime: undefined,
      type: 'file'
    })
  })

  it('should return correct values for a note with on Select function - better for performance', () => {
    const folders = [{ _id: 'folderId', path: 'folderPath' }]
    const file = {
      _id: 'fileId',
      id: 'noteId',
      dir_id: 'folderId',
      type: 'file',
      name: 'fileName',
      ...noteFileProps
    }

    const normalizedFile = makeNormalizedFile(client, folders, file)

    expect(normalizedFile).toEqual({
      id: 'fileId',
      name: 'note.cozy-note',
      path: 'folderPath',
      url: '/n/noteId',
      parentUrl: '/folder/folderId',
      openOn: 'notes',
      mime: undefined,
      type: 'file'
    })
  })

  it('should not return filled onSelect for a note without metadata', () => {
    const folders = [{ _id: 'folderId', path: 'folderPath' }]
    const file = {
      _id: 'fileId',
      id: 'noteId',
      dir_id: 'folderId',
      type: 'file',
      name: 'note.cozy-note'
    }

    const normalizedFile = makeNormalizedFile(client, folders, file)

    expect(normalizedFile).toEqual({
      id: 'fileId',
      name: 'note.cozy-note',
      path: 'folderPath',
      url: '/folder/folderId/file/fileId',
      parentUrl: '/folder/folderId',
      openOn: 'drive',
      mime: undefined,
      type: 'file'
    })
  })

  it('should include driveId when file is OnlyOffice document', () => {
    models.file.shouldBeOpenedByOnlyOffice = jest.fn(() => true)
    const folders = [{ _id: 'folderId', path: 'folderPath' }]
    const file = {
      _id: 'fileId',
      id: 'onlyofficeId',
      dir_id: 'folderId',
      type: 'file',
      name: 'document.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      class: 'document',
      driveId: 'drive123'
    }

    const normalizedFile = makeNormalizedFile(client, folders, file)

    expect(normalizedFile.url).toContain('/onlyoffice/drive123/')
  })

  it('should route a PDF search result to OnlyOffice only when Office is available', () => {
    const folders = [{ _id: 'folderId', path: 'folderPath' }]
    const file = {
      _id: 'pdfId',
      id: 'pdfId',
      dir_id: 'folderId',
      type: 'file',
      name: 'contract.pdf',
      mime: 'application/pdf',
      class: 'pdf',
      driveId: 'drive123'
    }

    const enabledFile = makeNormalizedFile(client, folders, file, true)
    const disabledFile = makeNormalizedFile(client, folders, file, false)

    expect(enabledFile.url).toBe(
      '/onlyoffice/drive123/pdfId?redirectLink=drive%23%2Ffolder%2FfolderId'
    )
    expect(disabledFile.url).toBe('/folder/folderId/file/pdfId')
  })

  it('indexes PDF results with the Office availability of the current device', async () => {
    const rows = [
      {
        id: 'folderId',
        doc: { _id: 'folderId', type: TYPE_DIRECTORY, path: '/documents' }
      },
      {
        id: 'pdfId',
        doc: {
          _id: 'pdfId',
          id: 'pdfId',
          dir_id: 'folderId',
          type: 'file',
          path: '/documents/contract.pdf',
          name: 'contract.pdf',
          mime: 'application/pdf',
          class: 'pdf'
        }
      }
    ]
    const searchClient = createMockClient({})
    searchClient.getStackClient = () => ({
      fetchJSON: jest.fn().mockResolvedValue({ rows })
    })

    const enabledIndex = await indexFiles(searchClient, true)
    const disabledIndex = await indexFiles(searchClient, false)

    expect(enabledIndex.search('contract')[0].url).toContain(
      '/onlyoffice/pdfId'
    )
    expect(disabledIndex.search('contract')[0].url).toBe(
      '/folder/folderId/file/pdfId'
    )
  })
})
