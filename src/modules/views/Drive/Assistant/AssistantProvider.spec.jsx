import { act, fireEvent, render, screen } from '@testing-library/react'
import { strFromU8, unzipSync } from 'fflate'
import React from 'react'

import { createMockClient, models } from 'cozy-client'
import flag from 'cozy-flags'

import AppLike from 'test/components/AppLike'

import logger from '@/lib/logger'
import { createFolder } from '@/modules/navigation/duck'
import {
  AssistantProvider,
  useAssistant
} from '@/modules/views/Drive/Assistant/AssistantProvider'
import { DOCX_MIME_TYPE } from '@/modules/views/Drive/Assistant/markdownToDocx'

jest.mock('cozy-flags')
jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))
jest.mock('@/modules/navigation/duck', () => ({ createFolder: jest.fn() }))
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => thunk => thunk()
}))

const ASSISTANTS = [
  {
    _id: 'projects',
    relationships: {
      knowledgeBase: {
        data: [
          { _id: 'projects-dir', _type: 'io.cozy.files' },
          { _type: 'io.cozy.emails' }
        ]
      }
    }
  }
]

const DOCUMENT = {
  tool: 'create_document',
  params: { title: 'Atlas report' },
  text: '# Atlas **report**\n\n## Status\nOn time.',
  format: 'markdown'
}

const AssistantState = ({ results }) => {
  const {
    isAvailable,
    isKnowledgeBaseFolder,
    isOpen,
    open,
    close,
    applyResult
  } = useAssistant()

  return (
    <>
      <output data-testid="state">
        {JSON.stringify({ isAvailable, isKnowledgeBaseFolder, isOpen })}
      </output>
      <button onClick={open}>open</button>
      <button onClick={close}>close</button>
      {results.map((result, index) => (
        <button key={index} onClick={() => applyResult(result)}>
          {`result ${index}`}
        </button>
      ))}
    </>
  )
}

const TOOL_ERROR = 'The assistant asked for something Drive cannot do.'
const FOLDER_ERROR = 'The folder could not be created, please try again.'
const DOCUMENT_ERROR = 'The document could not be created, please try again.'

const getState = () => JSON.parse(screen.getByTestId('state').textContent)

const setup = ({
  folderId = 'projects-dir',
  results = [],
  canWrite = true
} = {}) => {
  const client = createMockClient({
    queries: {
      'io.cozy.ai.chat.assistants': {
        doctype: 'io.cozy.ai.chat.assistants',
        definition: { doctype: 'io.cozy.ai.chat.assistants' },
        data: ASSISTANTS
      }
    }
  })
  const create = jest.fn().mockResolvedValue(undefined)
  createFolder.mockReturnValue(create)
  const upload = jest
    .spyOn(models.file, 'uploadFileWithConflictStrategy')
    .mockResolvedValue({ data: { _id: 'new-document' } })

  render(
    <AppLike
      client={client}
      sharingContextValue={{
        hasWriteAccess: id => id === folderId && canWrite,
        getRecipients: () => []
      }}
    >
      <AssistantProvider folderId={folderId}>
        <AssistantState results={results} />
      </AssistantProvider>
    </AppLike>
  )

  const apply = async index => {
    await act(async () => {
      fireEvent.click(screen.getByText(`result ${index}`))
    })
  }

  return { client, create, upload, apply }
}

describe('AssistantProvider', () => {
  beforeEach(() => {
    flag.mockImplementation(name => name === 'cozy.assistant.enabled')
  })

  it('is available, and opens and closes', () => {
    setup()

    expect(getState()).toEqual({
      isAvailable: true,
      isKnowledgeBaseFolder: true,
      isOpen: false
    })

    fireEvent.click(screen.getByText('open'))
    expect(getState().isOpen).toBe(true)

    fireEvent.click(screen.getByText('close'))
    expect(getState().isOpen).toBe(false)
  })

  it('knows a folder no assistant answers from', () => {
    setup({ folderId: 'other-dir' })

    expect(getState().isKnowledgeBaseFolder).toBe(false)
  })

  it('is not available without the flag', () => {
    flag.mockReturnValue(false)
    setup()

    expect(getState()).toEqual({ isAvailable: false, isOpen: false })
  })

  it('is not available without the provider', () => {
    render(<AssistantState results={[]} />)

    expect(JSON.parse(screen.getByTestId('state').textContent)).toEqual({
      isAvailable: false,
      isOpen: false
    })
  })

  it('creates the folder the assistant has made in the displayed folder', async () => {
    const { client, create, apply } = setup({
      results: [{ tool: 'create_folder', params: { name: ' Factures/2026. ' } }]
    })

    await apply(0)

    expect(createFolder).toHaveBeenCalledWith(
      client,
      'Factures 2026',
      'projects-dir',
      { showAlert: expect.any(Function), t: expect.any(Function) },
      null,
      expect.any(Function)
    )
    expect(create).toHaveBeenCalled()
    expect(await screen.findByText('Folder created')).toBeInTheDocument()
  })

  it('leaves telling a failed folder creation to createFolder', async () => {
    const { create, apply } = setup({
      results: [{ tool: 'create_folder', params: { name: 'Factures' } }]
    })
    create.mockRejectedValue(new Error('alert.folder_name'))

    await apply(0)

    expect(screen.queryByText('Folder created')).toBe(null)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('refuses a call confirmed in a read-only folder', async () => {
    const { upload, apply } = setup({
      results: [{ tool: 'create_folder', params: { name: 'Notes' } }, DOCUMENT],
      canWrite: false
    })

    await apply(0)
    await apply(1)

    expect(createFolder).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(
      await screen.findByText(
        'This folder is read-only, nothing can be created in it.'
      )
    ).toBeInTheDocument()
  })

  it('uploads the document the assistant has written, as a .docx named after its title', async () => {
    const { client, upload, apply } = setup({ results: [DOCUMENT] })

    await apply(0)

    expect(upload).toHaveBeenCalledWith(client, expect.any(ArrayBuffer), {
      name: 'Atlas report.docx',
      dirId: 'projects-dir',
      conflictStrategy: 'rename',
      contentType: DOCX_MIME_TYPE
    })
    const files = unzipSync(new Uint8Array(upload.mock.calls[0][1]))
    const document = strFromU8(files['word/document.xml'])
    expect(document).toContain(
      '<w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">Atlas report</w:t>'
    )
    expect(document.match(/Atlas/g)).toHaveLength(1)
    expect(document).toContain('On time.')
    expect(await screen.findByText('Document created')).toBeInTheDocument()
  })

  it('names the document after the title parameter when the text has no heading', async () => {
    const { upload, apply } = setup({
      results: [{ ...DOCUMENT, text: 'On time.' }]
    })

    await apply(0)

    expect(upload).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(ArrayBuffer),
      expect.objectContaining({ name: 'Atlas report.docx' })
    )
  })

  it('names the document after the title parameter when the heading is empty', async () => {
    const { upload, apply } = setup({
      results: [{ ...DOCUMENT, text: '# ***\nOn time.' }]
    })

    await apply(0)

    expect(upload).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(ArrayBuffer),
      expect.objectContaining({ name: 'Atlas report.docx' })
    )
  })

  it('says when the document could not be created', async () => {
    const { upload, apply } = setup({ results: [DOCUMENT] })
    upload.mockRejectedValue(new Error('Network'))

    await apply(0)

    expect(
      await screen.findByText(
        'The document could not be created, please try again.'
      )
    ).toBeInTheDocument()
  })

  it.each([
    [{ tool: 'delete_folder', params: {} }, TOOL_ERROR],
    [null, TOOL_ERROR],
    [{ tool: 'create_folder', params: {} }, FOLDER_ERROR],
    [{ tool: 'create_folder', params: { name: ' / ' } }, FOLDER_ERROR],
    [
      { tool: 'create_document', params: { title: '' }, text: 'Text' },
      DOCUMENT_ERROR
    ],
    [{ tool: 'create_document', params: {} }, DOCUMENT_ERROR]
  ])('tells the user it cannot use the call %j', async (result, message) => {
    const { upload, apply } = setup({ results: [result] })

    await apply(0)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(createFolder).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })
})
