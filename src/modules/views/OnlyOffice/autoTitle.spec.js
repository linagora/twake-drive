import { updateFileNameQuery } from '@/modules/drive/RenameInput'
import { makeAutoTitleEvents } from '@/modules/views/OnlyOffice/autoTitle'

jest.mock('@/modules/drive/RenameInput', () => ({
  updateFileNameQuery: jest.fn()
}))

const setup = ({ name = 'New text document.docx', text = 'Roadmap. Q1' }) => {
  const file = { _id: '123', name }
  const client = { getDocumentFromState: jest.fn(() => file) }
  const docEditor = { downloadAs: jest.fn() }
  global.fetch = jest.fn(async () => ({ ok: true, text: async () => text }))
  const events = makeAutoTitleEvents({
    client,
    docEditorRef: { current: docEditor },
    fileId: '123',
    untitledName: 'New text document'
  })

  return { client, file, docEditor, events }
}

describe('makeAutoTitleEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should request the text content once changes are saved on an untitled document', () => {
    const { docEditor, events } = setup({})

    events.onDocumentStateChange({ data: true })
    expect(docEditor.downloadAs).not.toHaveBeenCalled()

    events.onDocumentStateChange({ data: false })
    expect(docEditor.downloadAs).toHaveBeenCalledWith('txt')
  })

  it('should not request the text content of a renamed document', () => {
    const { docEditor, events } = setup({ name: 'Roadmap.docx' })

    events.onDocumentStateChange({ data: false })

    expect(docEditor.downloadAs).not.toHaveBeenCalled()
  })

  it('should rename the document after its first sentence', async () => {
    const { client, file, events } = setup({})

    await events.onDownloadAs({ data: { fileType: 'txt', url: 'http://oo' } })

    expect(updateFileNameQuery).toHaveBeenCalledWith(
      client,
      file,
      'Roadmap.docx'
    )
  })

  it('should add a suffix when the name is already taken', async () => {
    const { client, file, events } = setup({})
    updateFileNameQuery
      .mockRejectedValueOnce({ status: 409 })
      .mockRejectedValueOnce({ status: 409 })

    await events.onDownloadAs({ data: { fileType: 'txt', url: 'http://oo' } })

    expect(updateFileNameQuery.mock.calls.map(([, , name]) => name)).toEqual([
      'Roadmap.docx',
      'Roadmap (1).docx',
      'Roadmap (2).docx'
    ])
    expect(updateFileNameQuery).toHaveBeenLastCalledWith(
      client,
      file,
      'Roadmap (2).docx'
    )
  })

  it('should not rename the document while its first sentence is incomplete', async () => {
    const { events } = setup({ text: 'Roadm' })

    await events.onDownloadAs({ data: { fileType: 'txt', url: 'http://oo' } })

    expect(updateFileNameQuery).not.toHaveBeenCalled()
  })
})
