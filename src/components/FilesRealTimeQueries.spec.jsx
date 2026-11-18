import { render, waitFor } from '@testing-library/react'
import React from 'react'

import { CozyProvider, Q, createMockClient } from 'cozy-client'

import FilesRealTimeQueries from './FilesRealTimeQueries'

const ROOT_DIR_ID = 'io.cozy.files.root-dir'
const ROOT_QUERY_ID = 'io.cozy.files/root-dir'

const shortcut = {
  _id: 'shortcut-id',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'Shared drive.url',
  dir_id: ROOT_DIR_ID,
  path: '/Shared drive.url'
}

const otherFile = {
  _id: 'other-file-id',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'notes.txt',
  dir_id: ROOT_DIR_ID,
  path: '/notes.txt'
}

const DOWNLOADS_QUERY_ID = 'io.cozy.files/downloads'
const downloadsReference = {
  type: 'io.cozy.apps',
  id: 'io.cozy.apps/downloads'
}

const downloadsFolder = {
  _id: 'downloads-id',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Downloads',
  dir_id: ROOT_DIR_ID,
  path: '/Downloads',
  referenced_by: [downloadsReference]
}

const setup = () => {
  const client = createMockClient({
    queries: {
      [DOWNLOADS_QUERY_ID]: {
        doctype: 'io.cozy.files',
        definition: Q('io.cozy.files').where({
          referenced_by: { $elemMatch: downloadsReference }
        }),
        data: [downloadsFolder]
      },
      [ROOT_QUERY_ID]: {
        doctype: 'io.cozy.files',
        definition: Q('io.cozy.files').where({ dir_id: ROOT_DIR_ID }),
        data: [shortcut, otherFile]
      }
    }
  })
  const handlers = {}
  client.plugins = {
    realtime: {
      subscribe: jest.fn((event, doctype, handler) => {
        handlers[event] = handler
      }),
      unsubscribe: jest.fn()
    }
  }
  render(
    <CozyProvider client={client}>
      <FilesRealTimeQueries />
    </CozyProvider>
  )
  return { client, handlers }
}

const rootQueryIds = client =>
  client.getQueryFromState(ROOT_QUERY_ID).data.map(doc => doc._id)

describe('FilesRealTimeQueries', () => {
  it('removes a file deleted outside of the trash from the store', async () => {
    const { client, handlers } = setup()
    expect(rootQueryIds(client)).toContain(shortcut._id)

    // The stack destroys a shared drive shortcut right in My Drive, without
    // moving it to the trash first, when its recipient leaves the drive.
    const { _type, path, ...deletedDoc } = shortcut
    handlers.deleted(deletedDoc)

    await waitFor(() => {
      expect(rootQueryIds(client)).not.toContain(shortcut._id)
    })
    expect(rootQueryIds(client)).toContain(otherFile._id)
    expect(client.getDocumentFromState('io.cozy.files', shortcut._id)).toBe(
      null
    )
  })

  it('does not fetch the parent of a deleted file, which may be gone too', async () => {
    const { client, handlers } = setup()

    handlers.deleted({
      _id: 'child-of-destroyed-dir',
      type: 'file',
      name: 'child.txt',
      dir_id: 'destroyed-dir-id'
    })
    handlers.deleted({ ...otherFile, dir_id: 'io.cozy.files.trash-dir' })

    await waitFor(() => {
      expect(rootQueryIds(client)).not.toContain(otherFile._id)
    })
    expect(client.query).not.toHaveBeenCalled()
  })

  it('clears the references of a folder that lost them', async () => {
    const { client, handlers } = setup()
    const { _type, referenced_by, ...renamedFolder } = downloadsFolder

    handlers.updated({ ...renamedFolder, name: 'Old downloads' })

    await waitFor(() => {
      expect(client.getQueryFromState(DOWNLOADS_QUERY_ID).data).toEqual([])
    })
    expect(
      client.getDocumentFromState('io.cozy.files', downloadsFolder._id)
        .referenced_by
    ).toEqual([])
  })
})
