import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import flag from 'cozy-flags'

import AppLike from 'test/components/AppLike'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import logger from '@/lib/logger'
import {
  AssistantProvider,
  useAssistant
} from '@/modules/views/Drive/Assistant/AssistantProvider'

jest.mock('cozy-flags')
jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))
jest.mock('@/hooks', () => ({ useDisplayedFolder: jest.fn() }))

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

const FOLDER = { _id: 'folder-id', id: 'folder-id', type: 'directory' }

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

const getState = () => JSON.parse(screen.getByTestId('state').textContent)

const setup = ({
  folderId = 'projects-dir',
  results = [],
  displayedFolder = FOLDER
} = {}) => {
  useDisplayedFolder.mockReturnValue({ displayedFolder })
  const client = createMockClient({
    queries: {
      'io.cozy.ai.chat.assistants': {
        doctype: 'io.cozy.ai.chat.assistants',
        definition: { doctype: 'io.cozy.ai.chat.assistants' },
        data: ASSISTANTS
      }
    }
  })
  const create = jest.fn().mockResolvedValue({ data: { _id: 'new-folder' } })
  jest.spyOn(client, 'collection').mockReturnValue({ create })

  render(
    <AppLike client={client}>
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

  return { client, create, apply }
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
    useDisplayedFolder.mockReturnValue({ displayedFolder: null })
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
      results: [{ tool: 'create_folder', params: { name: 'Notes' } }],
      displayedFolder: null
    })

    await apply(0)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ dirId: ROOT_DIR_ID })
    )
  })

  it('creates in the root rather than in the trash', async () => {
    const { create, apply } = setup({
      results: [{ tool: 'create_folder', params: { name: 'Notes' } }],
      displayedFolder: { ...FOLDER, _id: TRASH_DIR_ID, id: TRASH_DIR_ID }
    })

    await apply(0)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ dirId: ROOT_DIR_ID })
    )
  })

  it('says when a folder with that name already exists', async () => {
    const { create, apply } = setup({
      results: [{ tool: 'create_folder', params: { name: 'Factures' } }]
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
      results: [{ tool: 'create_folder', params: { name: 'Factures' } }]
    })
    create.mockRejectedValue(new Error('Network'))

    await apply(0)

    expect(
      await screen.findByText(
        'The folder could not be created, please try again.'
      )
    ).toBeInTheDocument()
  })

  it('ignores an unknown tool and wrong parameters', async () => {
    const results = [
      { tool: 'delete_folder', params: {} },
      { tool: 'create_folder', params: {} },
      { tool: 'create_folder', params: { name: ' / ' } },
      null
    ]
    const { create, apply } = setup({ results })

    for (let index = 0; index < results.length; index += 1) {
      await apply(index)
    }

    expect(create).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(results.length)
  })
})
