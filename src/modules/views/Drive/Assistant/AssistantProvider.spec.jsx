import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppLike from 'test/components/AppLike'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import logger from '@/lib/logger'
import {
  AssistantProvider,
  useAssistant
} from '@/modules/views/Drive/Assistant/AssistantProvider'

jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))
jest.mock('@/hooks', () => ({ useDisplayedFolder: jest.fn() }))

const FOLDER = { _id: 'folder-id', id: 'folder-id', type: 'directory' }

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

  return { client, create, getState, apply }
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

  it('ignores an unknown capability and wrong parameters', async () => {
    const results = [
      { capability: 'delete_folder', params: {} },
      { capability: 'create_folder', params: {} },
      { capability: 'create_folder', params: { name: ' / ' } },
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
