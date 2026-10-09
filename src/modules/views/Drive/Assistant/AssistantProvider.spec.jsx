import { act, fireEvent, render, screen } from '@testing-library/react'
import { strFromU8, unzipSync } from 'fflate'
import React from 'react'

import { createMockClient, models } from 'cozy-client'

import AppLike from 'test/components/AppLike'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import logger from '@/lib/logger'
import {
  AssistantProvider,
  useAssistant
} from '@/modules/views/Drive/Assistant/AssistantProvider'
import { DOCX_MIME_TYPE } from '@/modules/views/Drive/Assistant/markdownToDocx'

jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))
jest.mock('@/hooks', () => ({ useDisplayedFolder: jest.fn() }))

const FOLDER = { _id: 'folder-id', id: 'folder-id', type: 'directory' }

const DOCUMENT = {
  capability: 'create_document',
  params: { title: 'Atlas report' },
  text: '# Atlas **report**\n\n## Status\nOn time.',
  format: 'markdown'
}

const AssistantState = ({ results }) => {
  const { isAvailable, isOpen, open, close, applyResult } = useAssistant()

  return (
    <>
      <output data-testid="state">
        {JSON.stringify({ isAvailable, isOpen })}
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

const setup = ({ results = [], displayedFolder = FOLDER } = {}) => {
  useDisplayedFolder.mockReturnValue({ displayedFolder })
  const client = createMockClient({})
  const create = jest.fn().mockResolvedValue({ data: { _id: 'new-folder' } })
  jest.spyOn(client, 'collection').mockReturnValue({ create })
  const upload = jest
    .spyOn(models.file, 'uploadFileWithConflictStrategy')
    .mockResolvedValue({ data: { _id: 'new-document' } })

  render(
    <AppLike client={client}>
      <AssistantProvider>
        <AssistantState results={results} />
      </AssistantProvider>
    </AppLike>
  )

  const getState = () => JSON.parse(screen.getByTestId('state').textContent)
  const apply = async index => {
    await act(async () => {
      fireEvent.click(screen.getByText(`result ${index}`))
    })
  }

  return { client, create, upload, getState, apply }
}

describe('AssistantProvider', () => {
  it('is available, and opens and closes', () => {
    const { getState } = setup()

    expect(getState()).toEqual({ isAvailable: true, isOpen: false })

    fireEvent.click(screen.getByText('open'))
    expect(getState().isOpen).toBe(true)

    fireEvent.click(screen.getByText('close'))
    expect(getState().isOpen).toBe(false)
  })

  it('is not available without the provider', () => {
    useDisplayedFolder.mockReturnValue({ displayedFolder: null })
    render(<AssistantState results={[]} />)

    expect(JSON.parse(screen.getByTestId('state').textContent)).toEqual({
      isAvailable: false,
      isOpen: false
    })
  })

  it('creates the folder the assistant has made in the displayed folder', async () => {
    const { client, create, apply } = setup({
      results: [
        { capability: 'create_folder', params: { name: ' Factures/2026. ' } }
      ]
    })

    await apply(0)

    expect(client.collection).toHaveBeenCalledWith('io.cozy.files')
    expect(create).toHaveBeenCalledWith({
      name: 'Factures 2026',
      dirId: 'folder-id',
      type: 'directory'
    })
    expect(await screen.findByText('Folder created')).toBeInTheDocument()
  })

  it('creates in the root while the folder is not loaded', async () => {
    const { create, apply } = setup({
      results: [{ capability: 'create_folder', params: { name: 'Notes' } }],
      displayedFolder: null
    })

    await apply(0)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ dirId: ROOT_DIR_ID })
    )
  })

  it('creates in the root rather than in the trash', async () => {
    const { create, apply } = setup({
      results: [{ capability: 'create_folder', params: { name: 'Notes' } }],
      displayedFolder: { ...FOLDER, _id: TRASH_DIR_ID, id: TRASH_DIR_ID }
    })

    await apply(0)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ dirId: ROOT_DIR_ID })
    )
  })

  it('says when a folder with that name already exists', async () => {
    const { create, apply } = setup({
      results: [{ capability: 'create_folder', params: { name: 'Factures' } }]
    })
    create.mockRejectedValue(
      Object.assign(new Error('Conflict'), { status: 409 })
    )

    await apply(0)

    expect(
      await screen.findByText(
        'The element Factures already exists, please choose a new name.'
      )
    ).toBeInTheDocument()
  })

  it('says when the folder could not be created', async () => {
    const { create, apply } = setup({
      results: [{ capability: 'create_folder', params: { name: 'Factures' } }]
    })
    create.mockRejectedValue(new Error('Network'))

    await apply(0)

    expect(
      await screen.findByText(
        'The folder could not be created, please try again.'
      )
    ).toBeInTheDocument()
  })

  it('uploads the document the assistant has written, as a .docx named after its title', async () => {
    const { client, upload, apply } = setup({ results: [DOCUMENT] })

    await apply(0)

    expect(upload).toHaveBeenCalledWith(client, expect.any(ArrayBuffer), {
      name: 'Atlas report.docx',
      dirId: 'folder-id',
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

  it('ignores an unknown capability and wrong parameters', async () => {
    const results = [
      { capability: 'delete_folder', params: {} },
      { capability: 'create_folder', params: {} },
      { capability: 'create_folder', params: { name: ' / ' } },
      { capability: 'create_document', params: { title: '' }, text: 'Text' },
      { capability: 'create_document', params: {} },
      null
    ]
    const { create, upload, apply } = setup({ results })

    for (let index = 0; index < results.length; index += 1) {
      await apply(index)
    }

    expect(create).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(results.length)
  })
})
