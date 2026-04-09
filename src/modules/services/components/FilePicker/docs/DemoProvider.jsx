import React from 'react'

import CozyClient, { CozyProvider } from 'cozy-client'
import { initQuery, receiveQueryResult } from 'cozy-client/dist/store'
import { normalizeDoc } from 'cozy-stack-client'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { I18nContext } from 'twake-i18n'

/**
 * @typedef {object} CreateMockClientForDocParam
 * @property {object} [queries] - Prefill queries inside the store
 */
/**
 * @typedef {object} FillQueryInsideClientQueryOptions
 * @property {IOCozyFile[]} data - Array of IOCozyFile
 * @property {{ doctype: string, selector: object }} definition - Prefill queries inside the store
 */

/**
 * @param {CozyClient} client - Instance of CozyClient
 * @param {string} queryName - Name of the query
 * @param {FillQueryInsideClientQueryOptions} queryOptions - Options of the query
 */
const fillQueryInsideClient = (client, queryName, queryOptions) => {
  const { definition, data } = queryOptions
  client.store.dispatch(initQuery(queryName, definition))
  client.store.dispatch(
    receiveQueryResult(queryName, {
      data: data ? data.map(doc => normalizeDoc(doc, definition.doctype)) : []
    })
  )
}

/**
 * Creates a client suitable for use in Documentation
 *
 * @param {CreateMockClientForDocParam} param
 * @returns {CozyClient} Instance of CozyClient
 */
const createMockClientForDoc = ({ queries = {} }) => {
  const client = new CozyClient()
  client.ensureStore()

  for (let [queryName, queryOptions] of Object.entries(queries)) {
    fillQueryInsideClient(client, queryName, queryOptions)
  }

  return client
}

const setupClient = () => {
  const client = createMockClientForDoc({
    queries: {
      'onlyfolder-io.cozy.files.root-dir': {
        data: [
          {
            _id: 'io.cozy.files.root-dir',
            id: 'io.cozy.files.root-dir',
            _type: 'io.cozy.files',
            type: 'directory',
            dir_id: 'io.cozy.files.root-dir',
            name: 'io.cozy.files.root-dir',
            updated_at: '2021-01-01T12:00:00.000000+01:00'
          }
        ],
        definition: {
          doctype: 'io.cozy.files',
          selector: {
            dir_id: 'io.cozy.files.root-dir'
          }
        }
      },

      'buildContentFolderQuery-io.cozy.files.root-dir': {
        data: [
          {
            _id: 'folder.01.id',
            id: 'folder.01.id',
            _type: 'io.cozy.files',
            type: 'directory',
            dir_id: 'io.cozy.files.root-dir',
            name: 'Folder one',
            updated_at: '2021-01-01T12:00:00.000000+01:00'
          },
          {
            _id: 'folder.02.id',
            id: 'folder.02.id',
            _type: 'io.cozy.files',
            type: 'directory',
            dir_id: 'io.cozy.files.root-dir',
            name: 'Folder two',
            updated_at: '2021-01-01T12:00:00.000000+01:00'
          },
          {
            _id: 'file.a.id',
            id: 'file.a.id',
            _type: 'io.cozy.files',
            type: 'file',
            dir_id: 'io.cozy.files.root-dir',
            name: 'File A.md',
            updated_at: '2021-01-01T12:00:00.000000+01:00',
            size: '111609'
          },
          {
            _id: 'file.b.id',
            id: 'file.b.id',
            _type: 'io.cozy.files',
            type: 'file',
            dir_id: 'io.cozy.files.root-dir',
            name: 'File B.png',
            updated_at: '2021-01-01T12:00:00.000000+01:00',
            size: '11160963'
          }
        ],
        definition: {
          doctype: 'io.cozy.files',
          selector: {
            dir_id: 'io.cozy.files.root-dir'
          }
        }
      },

      'onlyfolder-folder.01.id': {
        data: [
          {
            _id: 'folder.01.id',
            id: 'folder.01.id',
            _type: 'io.cozy.files',
            type: 'directory',
            dir_id: 'io.cozy.files.root-dir',
            name: 'Folder One',
            updated_at: '2021-01-01T12:00:00.000000+01:00'
          }
        ],
        definition: {
          doctype: 'io.cozy.files',
          selector: {
            dir_id: 'io.cozy.files.root-dir'
          }
        }
      },
      'buildContentFolderQuery-folder.01.id': {
        data: [
          {
            _id: 'folder.03.id',
            id: 'folder.03.id',
            _type: 'io.cozy.files',
            type: 'directory',
            dir_id: 'io.cozy.files.root-dir',
            name: 'Folder One',
            updated_at: '2021-01-01T12:00:00.000000+01:00'
          },
          {
            _id: 'file.c.id',
            id: 'file.c.id',
            _type: 'io.cozy.files',
            type: 'file',
            dir_id: 'folder.01.id',
            name: 'File C.txt',
            updated_at: '2021-01-01T12:00:00.000000+01:00',
            size: '111609'
          }
        ],
        definition: {
          doctype: 'io.cozy.files',
          selector: {
            dir_id: 'folder.01.id'
          }
        }
      },

      'onlyfolder-folder.02.id': {
        data: [
          {
            _id: 'folder.02.id',
            id: 'folder.02.id',
            _type: 'io.cozy.files',
            type: 'directory',
            dir_id: 'io.cozy.files.root-dir',
            name: 'Folder Two',
            updated_at: '2021-01-01T12:00:00.000000+01:00'
          }
        ],
        definition: {
          doctype: 'io.cozy.files',
          selector: {
            dir_id: 'io.cozy.files.root-dir'
          }
        }
      },
      'buildContentFolderQuery-folder.02.id': {
        data: [
          {
            _id: 'file.d.id',
            id: 'file.d.id',
            _type: 'io.cozy.files',
            type: 'file',
            dir_id: 'folder.02.id',
            name: 'File D.jpg',
            updated_at: '2021-01-01T12:00:00.000000+01:00',
            size: '222111'
          }
        ],
        definition: {
          doctype: 'io.cozy.files',
          selector: {
            dir_id: 'folder.02.id'
          }
        }
      },

      'onlyfolder-folder.03.id': {
        data: [
          {
            _id: 'folder.03.id',
            id: 'folder.03.id',
            _type: 'io.cozy.files',
            type: 'directory',
            dir_id: 'folder.01.id',
            name: 'Folder Three',
            updated_at: '2021-01-01T12:00:00.000000+01:00'
          }
        ],
        definition: {
          doctype: 'io.cozy.files',
          selector: {
            dir_id: 'folder.01.id'
          }
        }
      },
      'buildContentFolderQuery-folder.03.id': {
        data: [
          {
            _id: 'file.e.id',
            id: 'file.e.id',
            _type: 'io.cozy.files',
            type: 'file',
            dir_id: 'folder.03.id',
            name: 'File E.doc',
            updated_at: '2021-01-01T12:00:00.000000+01:00',
            size: '222111'
          }
        ],
        definition: {
          doctype: 'io.cozy.files',
          selector: {
            dir_id: 'folder.03.id'
          }
        }
      }
    }
  })

  return client
}

const mockClient = setupClient()

const Wrapper = ({ children }) => {
  return (
    <CozyProvider client={mockClient}>
      <BreakpointsProvider>
        <I18nContext.Provider
          value={{ t: x => x, f: () => '01 Jan. 2022', lang: 'en' }}
        >
          {children}
        </I18nContext.Provider>
      </BreakpointsProvider>
    </CozyProvider>
  )
}

export default Wrapper
