import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useState } from 'react'

import CozyClient, { CozyProvider } from 'cozy-client'
import { SharingContext } from 'cozy-sharing'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'

import { useMoveOperation } from './useMoveOperation'
import { TestI18n } from 'test/components/AppLike'

jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))
jest.mock('cozy-client', () => ({
  __esModule: true,
  ...jest.requireActual('cozy-client'),
  // The installed wrapper leaves an unhandled rejection on its .then branch.
  cancelable: promise => Object.assign(promise, { cancel: jest.fn() })
}))

const destination = {
  _id: 'destination',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Destination',
  path: '/Destination'
}
const sources = ['first', 'second'].map(id => ({
  _id: id,
  _type: 'io.cozy.files',
  type: 'file',
  name: `${id}.txt`,
  dir_id: 'source',
  path: `/Source/${id}.txt`
}))

function MoveOperationView({ entries }) {
  const [closed, setClosed] = useState(false)
  const [success, setSuccess] = useState(null)
  const operation = useMoveOperation({
    entries,
    currentFolder: { _id: 'source' },
    onClose: () => setClosed(true),
    onSuccess: (folder, movedEntries, trashedFiles) =>
      setSuccess({ folder, movedEntries, trashedFiles })
  })

  return (
    <>
      {closed ? (
        <p>Closed</p>
      ) : (
        <>
          <p>
            Pending:{' '}
            {operation.remainingEntries.map(item => item.name).join(', ')}
          </p>
          <p>Destination locked: {String(operation.isDestinationLocked)}</p>
          <button
            disabled={operation.isMoveInProgress}
            onClick={() => operation.onConfirm(destination)}
          >
            Move
          </button>
          <button
            disabled={operation.isMoveInProgress}
            onClick={operation.onClose}
          >
            Close picker
          </button>
          {operation.confirmationDialogs}
        </>
      )}
      {success && (
        <>
          <p>
            Moved: {success.movedEntries.map(item => item.name).join(', ')} to{' '}
            {success.folder.name}
          </p>
          <p>Replaced: {success.trashedFiles.join(', ')}</p>
        </>
      )}
    </>
  )
}

function setup({
  entries = sources,
  failedIds = new Set(),
  conflict = null
} = {}) {
  const documents = new Map(entries.map(item => [item._id, { ...item }]))
  if (conflict) documents.set(conflict._id, { ...conflict })
  const client = new CozyClient()
  const collection = {
    updateFileMetadata: async (id, attributes) => {
      if (failedIds.has(id)) throw new Error('Move unavailable')
      const file = documents.get(id)
      const existing = [...documents.values()].find(
        item =>
          item._id !== id &&
          !item.trashed &&
          item.dir_id === attributes.dir_id &&
          item.name === file.name
      )
      if (existing)
        throw Object.assign(new Error('Name conflict'), { status: 409 })
      const updated = { ...file, ...attributes, _rev: '2-moved' }
      documents.set(id, updated)
      return { data: updated }
    },
    statByPath: async path => ({
      data: [...documents.values()].find(
        item =>
          `${destination.path}/${item.name}` === path &&
          item.dir_id === destination._id &&
          !item.trashed
      )
    }),
    destroy: async file => {
      documents.set(file._id, { ...file, trashed: true })
      return { data: file }
    }
  }
  // The in-memory collection replaces the server, not the move model or controller.
  client.collection = () => collection
  client.query = async () => ({ data: destination })
  const sharingContext = {
    sharedPaths: [],
    byDocId: {},
    getSharedParentPath: () => null,
    getSharingForSelf: () => null,
    hasSharedParent: () => false,
    refresh: () => null
  }

  render(
    <CozyProvider client={client}>
      <TestI18n>
        <SharingContext.Provider value={sharingContext}>
          <AlertProvider>
            <MoveOperationView entries={entries} />
          </AlertProvider>
        </SharingContext.Provider>
      </TestI18n>
    </CozyProvider>
  )
  return { documents, failedIds }
}

describe('useMoveOperation', () => {
  it('keeps successful moves in place and retries only the pending file', async () => {
    const { documents, failedIds } = setup({ failedIds: new Set(['second']) })
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))

    await screen.findByText('Moved: 1. Failed: 1.')
    expect(screen.getByText('Pending: second.txt')).toBeInTheDocument()
    expect(screen.getByText('Destination locked: true')).toBeInTheDocument()
    expect(screen.queryByText('Closed')).toBe(null)
    const firstMoved = documents.get('first')
    expect(firstMoved.dir_id).toBe('destination')
    expect(documents.get('second').dir_id).toBe('source')

    failedIds.clear()
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))
    await screen.findByText('Closed')
    expect(
      screen.getByText('Moved: first.txt, second.txt to Destination')
    ).toBeInTheDocument()
    expect(documents.get('first')).toBe(firstMoved)
    expect(documents.get('second').dir_id).toBe('destination')
  })

  it('closes after a partial success without rolling back or reporting the failed file as moved', async () => {
    const { documents } = setup({ failedIds: new Set(['second']) })
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))
    await screen.findByText('Moved: 1. Failed: 1.')
    fireEvent.click(screen.getByRole('button', { name: 'Close picker' }))

    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(
      screen.getByText('Moved: first.txt to Destination')
    ).toBeInTheDocument()
    expect(documents.get('first').dir_id).toBe('destination')
    expect(documents.get('second').dir_id).toBe('source')
  })

  it('preserves the move model replacement and the replaced ID in the success notification', async () => {
    const conflict = {
      ...sources[0],
      _id: 'conflict',
      id: 'conflict',
      dir_id: 'destination'
    }
    const { documents } = setup({ entries: [sources[0]], conflict })
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))

    await waitFor(() =>
      expect(screen.queryByText('Closed')).toBeInTheDocument()
    )
    expect(documents.get('conflict').trashed).toBe(true)
    expect(documents.get('first').dir_id).toBe('destination')
    expect(
      screen.getByText('Moved: first.txt to Destination')
    ).toBeInTheDocument()
    expect(screen.getByText('Replaced: conflict')).toBeInTheDocument()
  })
})
