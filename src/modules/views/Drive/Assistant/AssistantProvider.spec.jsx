import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import flag from 'cozy-flags'

import AppLike from 'test/components/AppLike'

import logger from '@/lib/logger'
import { createFolder } from '@/modules/navigation/duck'
import {
  AssistantProvider,
  useAssistant
} from '@/modules/views/Drive/Assistant/AssistantProvider'

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
    const { apply } = setup({
      results: [{ tool: 'create_folder', params: { name: 'Notes' } }],
      canWrite: false
    })

    await apply(0)

    expect(createFolder).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText(
        'This folder is read-only, nothing can be created in it.'
      )
    ).toBeInTheDocument()
  })

  it.each([
    [{ tool: 'delete_folder', params: {} }, TOOL_ERROR],
    [null, TOOL_ERROR],
    [{ tool: 'create_folder', params: {} }, FOLDER_ERROR],
    [{ tool: 'create_folder', params: { name: ' / ' } }, FOLDER_ERROR]
  ])('tells the user it cannot use the call %j', async (result, message) => {
    const { apply } = setup({ results: [result] })

    await apply(0)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(createFolder).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })
})
