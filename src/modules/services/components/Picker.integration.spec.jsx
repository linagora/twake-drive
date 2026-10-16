import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import React from 'react'

import CozyClient from 'cozy-client'
import { useDataProxy } from 'cozy-dataproxy-lib'
import { SharingContext } from 'cozy-sharing'
import { SharingProvider } from 'cozy-sharing/dist/SharingProvider'

import { FILE_PICKER_VIEW_TYPE_STORAGE_KEY } from './FilePicker/constants'
import IntentHandler from './IntentHandler'
import { IntentLike } from 'test/components/IntentLike'

import { ROOT_DIR_ID, TRASH_DIR_ID, TRASH_DIR_PATH } from '@/constants/config'

const mockCreateService = jest.fn()
const mockGetIntent = jest.fn()

jest.mock('cozy-client', () => ({
  __esModule: true,
  ...jest.requireActual('cozy-client'),
  cancelable: promise => Object.assign(promise, { cancel: jest.fn() })
}))

jest.mock('cozy-logger', () => {
  const log = Object.assign(jest.fn(), {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  })
  log.namespace = () => log
  return log
})
jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))

jest.mock('cozy-interapp', () =>
  jest.fn().mockImplementation(() => ({
    createService: mockCreateService,
    request: { get: mockGetIntent }
  }))
)

jest.mock('cozy-dataproxy-lib', () => ({
  DataProxyProvider: ({ children }) => children,
  useDataProxy: jest.fn()
}))

// JSDOM has no viewport: replace virtualization only, keeping the real rows,
// cells, selection, navigation and confirmation handlers.
jest.mock('cozy-ui/transpiled/react/Table/Virtualized', () => {
  const React = require('react')
  const VirtualizedTable = React.forwardRef(
    (
      { rows, columns, context, components, componentsProps, isSelectedItem },
      ref
    ) => {
      const TableHead = components.TableHead
      const TableRow = components.TableRow
      return (
        <table ref={ref}>
          <TableHead>
            <tr>
              {columns.map(column => (
                <th key={column.id}>{column.label}</th>
              ))}
            </tr>
          </TableHead>
          <tbody>
            {rows.map(row => (
              <TableRow
                key={row._id}
                item={row}
                context={{ ...context, isSelectedItem }}
              >
                {columns.map(column => (
                  <td key={column.id}>
                    {React.cloneElement(componentsProps.rowContent.children, {
                      column,
                      row
                    })}
                  </td>
                ))}
              </TableRow>
            ))}
          </tbody>
        </table>
      )
    }
  )
  VirtualizedTable.displayName = 'VirtualizedTable'
  return { __esModule: true, default: VirtualizedTable }
})

jest.mock('cozy-ui/transpiled/react/GridList/Virtualized', () => ({
  __esModule: true,
  default: require('test/components/VirtualizedGridMock').VirtualizedGridMock
}))

async function switchView(viewType) {
  fireEvent.click(
    await screen.findByRole('button', {
      name: viewType === 'grid' ? 'Grid view' : 'List view'
    })
  )
}

const root = {
  _id: ROOT_DIR_ID,
  id: ROOT_DIR_ID,
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'My Drive',
  path: '/',
  dir_id: null
}
const projects = {
  _id: 'projects',
  id: 'projects',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Projects',
  path: '/Projects',
  dir_id: ROOT_DIR_ID
}
const child = {
  _id: 'child',
  id: 'child',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Child',
  path: '/Projects/Child',
  dir_id: 'projects'
}
const invoice = {
  _id: 'invoice',
  id: 'invoice',
  _type: 'io.cozy.files',
  _rev: '1-original',
  type: 'file',
  name: 'invoice.pdf',
  dir_id: 'projects',
  mime: 'application/pdf',
  size: '42',
  metadata: { author: 'Alice' },
  updated_at: '2025-01-01T12:00:00Z'
}
const nested = {
  ...invoice,
  _id: 'nested',
  id: 'nested',
  dir_id: 'child',
  name: 'nested.pdf'
}
const trashRoot = {
  _id: TRASH_DIR_ID,
  id: TRASH_DIR_ID,
  _type: 'io.cozy.files',
  type: 'directory',
  name: '.cozy_trash',
  path: TRASH_DIR_PATH,
  dir_id: ROOT_DIR_ID
}
const trashedFolder = {
  _id: 'trashed-folder',
  id: 'trashed-folder',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'TrashedFolder',
  path: `${TRASH_DIR_PATH}/TrashedFolder`,
  dir_id: TRASH_DIR_ID,
  restore_path: '/TrashedFolder'
}
const nestedTrashedFolder = {
  _id: 'nested-trashed',
  id: 'nested-trashed',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'NestedTrashed',
  path: `${TRASH_DIR_PATH}/TrashedFolder/NestedTrashed`,
  dir_id: 'trashed-folder',
  restore_path: '/TrashedFolder/NestedTrashed'
}
const trashArchiveFolder = {
  _id: 'trash-archive',
  id: 'trash-archive',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'trash-archive',
  path: '/trash-archive',
  dir_id: ROOT_DIR_ID
}
const trashArchiveChild = {
  _id: 'trash-archive-child',
  id: 'trash-archive-child',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'archive.pdf',
  dir_id: 'trash-archive',
  mime: 'application/pdf',
  size: '10'
}
const onlyDocuments = { documents: {}, sharingLink: null, downloadLink: null }

function setup(
  data = {},
  {
    files = [
      root,
      projects,
      child,
      invoice,
      nested,
      trashRoot,
      trashedFolder,
      nestedTrashedFolder,
      trashArchiveFolder,
      trashArchiveChild
    ],
    recents = [],
    simulatePermissions = false,
    rejectWarmupListing = false,
    action = 'PICK',
    hasWriteAccess = () => true,
    beforeRead = null,
    sharing = {}
  } = {}
) {
  const documents = new Map(files.map(file => [file._id, { ...file }]))
  const requests = []
  const writes = []
  let rejectedWarmup = false
  const client = new CozyClient({
    links: [
      {
        request: async operation => {
          if (operation.mutationType) {
            writes.push(operation)
            throw new Error('Navigation must not mutate documents')
          }
          requests.push(operation)
          if (operation.id) {
            if (beforeRead) await beforeRead(operation.id)
            const file = documents.get(
              operation.sharingId
                ? `${operation.sharingId}/${operation.id}`
                : operation.id
            )
            if (!file) throw new Error('Document not found')
            return { data: { ...file } }
          }
          if (rejectWarmupListing && !rejectedWarmup) {
            rejectedWarmup = true
            throw new Error('Warm-up content prefetch failed')
          }
          return {
            data:
              operation.doctype === 'io.cozy.files'
                ? [...documents.values()].filter(file =>
                    operation.selector?.path
                      ? file.path === operation.selector.path
                      : file.dir_id === operation.selector?.dir_id
                  )
                : [],
            next: false
          }
        },
        persistCozyData: async () => {}
      }
    ]
  })
  const permissions = new Map()
  let sharingProvider = null
  if (simulatePermissions) {
    client.getStackClient().setUri('https://alice.example')
    client.capabilities = { flat_subdomains: true }
    sharingProvider = new SharingProvider({
      client,
      doctype: 'io.cozy.files',
      documentType: 'Files'
    })
    sharingProvider.setState = update => {
      sharingProvider.state = {
        ...sharingProvider.state,
        ...update(sharingProvider.state)
      }
    }
    sharingProvider.permissionCol = {
      findLinksByDoctype: async () => ({ data: [...permissions.values()] }),
      createSharingLink: async document => {
        const permission = {
          id: `permission-${document._id}`,
          attributes: {
            permissions: { files: { verbs: ['GET'], values: [document._id] } },
            shortcodes: { code: 'new-sharecode' }
          }
        }
        permissions.set(document._id, permission)
        return { data: permission }
      }
    }
  }
  const intent = {
    attributes: { action, type: 'io.cozy.files', data }
  }
  const service = {
    getIntent: () => intent,
    getData: () => ({}),
    terminate: jest.fn(),
    cancel: jest.fn(),
    throw: jest.fn(),
    notifyReadyToUse: jest.fn()
  }
  mockGetIntent.mockResolvedValue(intent)
  mockCreateService.mockResolvedValue(service)
  useDataProxy.mockReturnValue({
    dataProxyServicesAvailable: true,
    recents: async () => recents
  })
  window.innerWidth = 1024
  const rendered = render(
    <IntentLike client={client}>
      <SharingContext.Provider
        value={{
          allLoaded: true,
          byDocId: {},
          isOwner: () => true,
          hasWriteAccess,
          sharedPaths: [],
          getSharedParentPath: () => null,
          getSharingForSelf: () => null,
          hasSharedParent: () => false,
          refresh: () => null,
          ensureSharingLink: sharingProvider?.ensureSharingLink,
          ...sharing
        }}
      >
        <IntentHandler intentId="intent-id" />
      </SharingContext.Provider>
    </IntentLike>
  )
  return {
    ...rendered,
    client,
    service,
    documents,
    requests,
    writes,
    permissions
  }
}

function getRow(id) {
  return (
    screen
      .queryAllByTestId(/^(list|grid)-item$/)
      .find(row => row.getAttribute('data-file-id') === id) ?? null
  )
}

async function waitForRow(id) {
  await waitFor(() => expect(getRow(id)).toBeInTheDocument())
  return getRow(id)
}

async function confirmDocument(id) {
  fireEvent.click(await waitForRow(id))
  fireEvent.click(screen.getByTestId('documents-btn'))
}

async function clickMove() {
  const moveButton = screen.getByRole('button', { name: 'Move' })
  await waitFor(() => expect(moveButton).not.toBeDisabled())
  fireEvent.click(moveButton)
}

function provideExistingSharingLink(client) {
  client.getStackClient().setUri('https://alice.example')
  client.capabilities = { flat_subdomains: true }
  return jest
    .spyOn(client.getStackClient(), 'fetchJSON')
    .mockImplementation(async method => {
      if (method !== 'GET')
        throw new Error('Existing links must not be changed')
      return {
        data: [
          {
            id: 'existing-permission',
            attributes: {
              permissions: { files: { verbs: ['GET'], values: ['invoice'] } },
              shortcodes: { code: 'existing-sharecode' }
            }
          }
        ]
      }
    })
}

describe('PICK intent integration', () => {
  beforeEach(() => {
    window.localStorage.removeItem(FILE_PICKER_VIEW_TYPE_STORAGE_KEY)
  })

  afterEach(() => {
    window.localStorage.removeItem(FILE_PICKER_VIEW_TYPE_STORAGE_KEY)
    jest.clearAllMocks()
  })

  it('restores the explicitly chosen view on the next PICK opening', async () => {
    const first = setup({ ...onlyDocuments, defaultDirId: 'projects' })
    await waitForRow('invoice')
    expect(screen.queryByRole('table')).toBeInTheDocument()

    await switchView('grid')
    expect(screen.queryByRole('table')).toBe(null)
    first.unmount()

    setup({ ...onlyDocuments, defaultDirId: 'projects' })
    expect(await waitForRow('invoice')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('table')).toBe(null)
  })

  it('switches presentation without losing selection, folder, action filters or writing Drive preferences', async () => {
    const { service, writes } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects',
      documents: { accept: ['file'] }
    })
    fireEvent.click(await waitForRow('invoice'))
    expect(
      screen.queryByRole('columnheader', { name: 'Name' })
    ).toBeInTheDocument()
    await switchView('grid')
    expect(screen.queryByRole('table')).toBe(null)
    expect(getRow('invoice')).toHaveAttribute('aria-pressed', 'true')
    expect(getRow('invoice')).toHaveAccessibleName('invoice.pdf')
    expect(screen.getByTestId('documents-btn')).not.toBeDisabled()
    expect(screen.getByTestId('file-picker-breadcrumb')).toHaveTextContent(
      'Projects'
    )
    await switchView('list')
    expect(
      screen.queryByRole('columnheader', { name: 'Name' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('documents-btn')).not.toBeDisabled()
    await switchView('grid')
    fireEvent.click(screen.getByTestId('documents-btn'))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...invoice, path: '/Projects/invoice.pdf' }
    ])
    expect(writes).toEqual([])
  })

  it('retains grid mode across folder and section navigation and returns to list without changing the folder', async () => {
    setup(
      { ...onlyDocuments, defaultDirId: 'projects' },
      { recents: [invoice] }
    )
    await switchView('grid')
    fireEvent.doubleClick(await waitForRow('child'))
    expect(await waitForRow('nested')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('list-item')).toBe(null)
    await switchView('list')
    expect(await waitForRow('nested')).toBeInTheDocument()
    expect(screen.queryByTestId('grid-item')).toBe(null)
    await switchView('grid')
    fireEvent.click(screen.getByRole('tab', { name: 'Recents' }))
    expect(await waitForRow('invoice')).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('tab', { name: 'My Drive' }))
    expect(await waitForRow('projects')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('extends the existing selection with grid keyboard arrows and confirms the actual range', async () => {
    const { service } = setup({ ...onlyDocuments, defaultDirId: 'projects' })
    fireEvent.click(await waitForRow('child'))
    await switchView('grid')
    fireEvent.keyDown(document, { key: 'ArrowRight', shiftKey: true })
    expect(getRow('child')).toHaveAttribute('aria-pressed', 'true')
    expect(getRow('invoice')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('documents-btn'))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      child,
      { ...invoice, path: '/Projects/invoice.pdf' }
    ])
  })

  it('opens a grid folder with Enter without Drive actions or a viewer', async () => {
    setup({ ...onlyDocuments, defaultDirId: 'projects' })
    await switchView('grid')
    fireEvent.keyDown(await waitForRow('child'), { key: 'Enter' })
    expect(await waitForRow('nested')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).toBe(null)
    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('preserves legacy default tabs and link actions, and cancellation has no result payload', async () => {
    const { service } = setup()
    await waitForRow('projects')
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'My Drive',
      'Recents',
      'Sharings'
    ])
    expect(screen.queryByTestId('documents-btn')).toBe(null)
    expect(screen.queryByTestId('public-link-btn')).toBeInTheDocument()
    expect(
      screen.queryByTestId('temporary-download-link-btn')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(service.cancel).toHaveBeenCalledWith()
    expect(service.terminate).not.toHaveBeenCalled()
  })

  it('controls action availability and confirms documents when configured with booleans', async () => {
    const { service } = setup({
      documents: true,
      sharingLink: false,
      downloadLink: true
    })
    await waitForRow('projects')
    expect(screen.getByTestId('documents-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('public-link-btn')).toBe(null)
    expect(
      screen.queryByTestId('temporary-download-link-btn')
    ).toBeInTheDocument()

    fireEvent.click(getRow('projects'))
    expect(screen.getByTestId('documents-btn')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('documents-btn'))

    await waitFor(() => {
      expect(service.terminate).toHaveBeenCalledWith([
        expect.objectContaining({ _id: 'projects', path: '/Projects' })
      ])
    })
  })

  it('hides all action buttons when all actions are set to false', async () => {
    const { service } = setup({
      documents: false,
      sharingLink: false,
      downloadLink: false
    })
    await waitForRow('projects')
    expect(screen.queryByTestId('documents-btn')).toBe(null)
    expect(screen.queryByTestId('public-link-btn')).toBe(null)
    expect(screen.queryByTestId('temporary-download-link-btn')).toBe(null)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(service.cancel).toHaveBeenCalledWith()
    expect(service.terminate).not.toHaveBeenCalled()
  })

  it('notifies readiness once through selection rerenders and section remounts', async () => {
    const { service } = setup({ documents: {} })
    fireEvent.click(await waitForRow('projects'))
    expect(screen.getByTestId('documents-btn')).not.toBeDisabled()
    fireEvent.click(screen.getByRole('tab', { name: 'Recents' }))
    await waitFor(() =>
      expect(screen.queryByTestId('file-picker-empty')).toBeInTheDocument()
    )
    expect(screen.getByTestId('documents-btn')).toBeDisabled()
    fireEvent.click(screen.getByRole('tab', { name: 'My Drive' }))
    await waitForRow('projects')
    expect(screen.getByTestId('documents-btn')).toBeDisabled()
    fireEvent.click(getRow('projects'))
    expect(screen.getByTestId('documents-btn')).not.toBeDisabled()
    expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
  })

  it('confirms Documents once when double clicks repeat across selection rerenders', async () => {
    const { service } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects'
    })
    fireEvent.doubleClick(await waitForRow('invoice'))
    fireEvent.doubleClick(getRow('invoice'))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...invoice, path: '/Projects/invoice.pdf' }
    ])
    expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
  })

  it('revalidates and returns complete Documents with a freshly computed absolute file path, without saving it', async () => {
    const { service, documents, writes, client } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects'
    })
    await waitForRow('invoice')
    documents.set('invoice', {
      ...invoice,
      _rev: '2-fresh',
      metadata: { author: 'Bob' },
      path: '/stale/invoice.pdf'
    })
    await confirmDocument('invoice')
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      {
        ...invoice,
        _rev: '2-fresh',
        metadata: { author: 'Bob' },
        path: '/Projects/invoice.pdf'
      }
    ])
    expect(writes).toEqual([])
    expect(documents.get('invoice').path).toBe('/stale/invoice.pdf')
    expect(client.getDocumentFromState('io.cozy.files', 'invoice').path).toBe(
      '/stale/invoice.pdf'
    )
    expect(screen.queryByTestId('public-link-btn')).toBe(null)
    expect(screen.queryByTestId('temporary-download-link-btn')).toBe(null)
  })

  it('includes the filename at the Drive root and preserves complete folder documents', async () => {
    const file = { ...invoice, dir_id: ROOT_DIR_ID }
    const { service } = setup(
      { documents: {} },
      { files: [root, projects, file] }
    )
    fireEvent.click(await waitForRow('invoice'))
    fireEvent.click(getRow('projects'), { ctrlKey: true })
    fireEvent.click(screen.getByTestId('documents-btn'))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...file, path: '/invoice.pdf' },
      projects
    ])
    expect(screen.queryByTestId('public-link-btn')).toBeInTheDocument()
    expect(
      screen.queryByTestId('temporary-download-link-btn')
    ).toBeInTheDocument()
  })

  it('ignores defaultDirId when Drive is hidden and opens the first visible tab in normal order', async () => {
    const { service, requests } = setup(
      {
        ...onlyDocuments,
        tabs: ['sharings', 'recents', 'recents'],
        defaultDirId: 'unresolvable'
      },
      { recents: [invoice] }
    )
    await waitForRow('invoice')
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Recents',
      'Sharings'
    ])
    expect(screen.getByRole('tab', { name: 'Recents' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await waitFor(() =>
      expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    )
    expect(requests.some(query => query.id === 'unresolvable')).toBe(false)
    expect(service.throw).not.toHaveBeenCalled()
  })

  it('starts and becomes ready with Sharings as the only visible tab', async () => {
    const { service } = setup({ ...onlyDocuments, tabs: ['sharings'] })
    await waitFor(() =>
      expect(screen.queryByTestId('file-picker')).toBeInTheDocument()
    )
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Sharings'
    ])
    expect(screen.getByRole('tab', { name: 'Sharings' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await waitFor(() =>
      expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    )
    expect(service.throw).not.toHaveBeenCalled()
  })

  it('keeps single selection as an array result, including document-only double click confirmation', async () => {
    const { service } = setup({
      ...onlyDocuments,
      multiple: false,
      defaultDirId: 'projects'
    })
    fireEvent.click(await waitForRow('child'))
    fireEvent.click(getRow('invoice'), { ctrlKey: true })
    fireEvent.doubleClick(getRow('invoice'))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...invoice, path: '/Projects/invoice.pdf' }
    ])
  })

  it('preserves local shared-folder selection without adding rights', async () => {
    const { service, writes } = setup(
      {
        ...onlyDocuments,
        defaultDirId: 'projects',
        restrictToDefaultDir: true
      },
      {
        files: [
          root,
          {
            ...projects,
            relationships: {
              referenced_by: {
                data: [{ id: 'sharing-id', type: 'io.cozy.sharings' }]
              }
            }
          },
          invoice
        ]
      }
    )
    await confirmDocument('invoice')
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...invoice, path: '/Projects/invoice.pdf' }
    ])
    expect(writes).toEqual([])
  })

  it('does not confirm a file deleted between listing and confirmation, and remains cancellable', async () => {
    const { service, documents } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects'
    })
    fireEvent.click(await waitForRow('invoice'))
    documents.delete('invoice')
    fireEvent.click(screen.getByTestId('documents-btn'))
    expect(await screen.findByTestId('file-picker-error')).toHaveTextContent(
      'The selected file could not be found.'
    )
    expect(service.terminate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(service.cancel).toHaveBeenCalledWith()
  })

  it('rejects a file trashed after selection instead of returning a deleted document', async () => {
    const { service, documents } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects'
    })
    fireEvent.click(await waitForRow('invoice'))
    documents.set('invoice', { ...invoice, trashed: true })
    fireEvent.click(screen.getByTestId('documents-btn'))
    expect(await screen.findByTestId('file-picker-error')).toBeInTheDocument()
    expect(service.terminate).not.toHaveBeenCalled()
  })

  it.each(['moved', 'deleted', 'mime-changed'])(
    'does not persist any public permission when a selected batch contains a %s file',
    async change => {
      const secondFile = { ...invoice, _id: 'second', id: 'second' }
      const { service, documents, permissions } = setup(
        {
          defaultDirId: 'projects',
          restrictToDefaultDir: true,
          sharingLink: { accept: ['application/pdf'] },
          downloadLink: null
        },
        {
          files: [root, projects, child, invoice, secondFile],
          simulatePermissions: true
        }
      )
      fireEvent.click(await waitForRow('invoice'))
      fireEvent.click(getRow('second'), { ctrlKey: true })
      fireEvent.click(screen.getByTestId('public-link-btn'))
      const confirm = await screen.findByRole('button', { name: 'Add links' })
      if (change === 'deleted') documents.delete('second')
      else {
        documents.set('second', {
          ...secondFile,
          ...(change === 'moved'
            ? { dir_id: ROOT_DIR_ID }
            : { mime: 'image/png' })
        })
      }
      fireEvent.click(confirm)
      expect(
        await screen.findByText(/Could not save link permissions/)
      ).toBeInTheDocument()
      expect(permissions.size).toBe(0)
      expect(service.terminate).not.toHaveBeenCalled()
    }
  )

  it('persists public permissions for a validated selection and returns its links', async () => {
    const { service, permissions } = setup(
      {
        defaultDirId: 'projects',
        restrictToDefaultDir: true,
        downloadLink: null
      },
      { simulatePermissions: true }
    )
    fireEvent.click(await waitForRow('invoice'))
    fireEvent.click(screen.getByTestId('public-link-btn'))
    fireEvent.click(await screen.findByRole('button', { name: 'Add links' }))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(
      permissions.get('invoice').attributes.permissions.files.values
    ).toEqual(['invoice'])
    expect(service.terminate.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({
        id: 'invoice',
        sharingLink: expect.stringContaining('sharecode=new-sharecode')
      })
    )
  })

  it.each([
    [{ maxFileSize: 50 }, { size: '100' }],
    [{ allowedMimeTypes: ['application/pdf'] }, { mime: 'image/png' }],
    [{ availableSize: 50 }, { size: '100' }]
  ])(
    'rejects existing-link double click when fresh metadata violates %j without accept',
    async (sharingLink, changedFields) => {
      const { service, documents, client } = setup({
        defaultDirId: 'projects',
        sharingLink,
        downloadLink: null
      })
      provideExistingSharingLink(client)
      const row = await waitForRow('invoice')
      documents.set('invoice', { ...invoice, ...changedFields })

      fireEvent.doubleClick(row)

      expect(await screen.findByTestId('file-picker-error')).toHaveTextContent(
        'The selected items do not meet the requirements for this action.'
      )
      expect(service.terminate).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBe(null)
      fireEvent.click(screen.getByRole('button', { name: /close/i }))
      expect(service.cancel).toHaveBeenCalledWith()
    }
  )

  it('still returns an existing sharing link on double click when fresh metadata meets legacy constraints', async () => {
    const { service, client } = setup({
      defaultDirId: 'projects',
      sharingLink: { maxFileSize: 50, allowedMimeTypes: ['application/pdf'] },
      downloadLink: null
    })
    provideExistingSharingLink(client)

    fireEvent.doubleClick(await waitForRow('invoice'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        id: 'invoice',
        size: 42,
        sharingLink: expect.stringContaining('sharecode=existing-sharecode')
      })
    ])
    expect(screen.queryByTestId('file-picker-error')).toBe(null)
    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('rechecks action-specific accept on refreshed link documents before generating any link', async () => {
    const { service, documents, writes } = setup({
      defaultDirId: 'projects',
      sharingLink: null,
      downloadLink: { accept: ['application/pdf'] }
    })
    fireEvent.click(await waitForRow('invoice'))
    documents.set('invoice', { ...invoice, mime: 'image/png' })
    fireEvent.click(screen.getByTestId('temporary-download-link-btn'))
    expect(await screen.findByTestId('file-picker-error')).toHaveTextContent(
      'The selected items do not meet the requirements for this action.'
    )
    expect(service.terminate).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('accepts no items for an explicit empty accept while keeping navigation usable', async () => {
    setup({
      ...onlyDocuments,
      documents: { label: 'Choose', accept: [], allowFolder: true },
      defaultDirId: 'projects'
    })
    fireEvent.click(await waitForRow('invoice'))
    expect(screen.getByRole('button', { name: /Choose/ })).toBeDisabled()
    fireEvent.click(getRow('child'))
    expect(screen.getByRole('button', { name: /Choose/ })).toBeDisabled()
    fireEvent.doubleClick(getRow('child'))
    await waitForRow('nested')
  })

  it('keeps cancellation available when all actions are hidden', async () => {
    const { service } = setup({
      documents: null,
      sharingLink: null,
      downloadLink: null
    })
    await waitForRow('projects')
    expect(screen.queryByTestId('documents-btn')).toBe(null)
    expect(screen.queryByTestId('public-link-btn')).toBe(null)
    expect(screen.queryByTestId('temporary-download-link-btn')).toBe(null)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(service.cancel).toHaveBeenCalledWith()
  })

  it('opens the configured local folder but allows leaving it when unrestricted', async () => {
    const { service } = setup({ ...onlyDocuments, defaultDirId: 'projects' })
    await waitForRow('invoice')
    const breadcrumb = within(screen.getByTestId('file-picker-breadcrumb'))
    expect(
      breadcrumb.queryByRole('button', { name: 'My Drive' })
    ).toBeInTheDocument()
    fireEvent.click(breadcrumb.getByRole('button', { name: 'My Drive' }))
    await waitForRow('projects')
    expect(getRow('invoice')).toBe(null)
    expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
  })

  it('anchors restricted breadcrumbs and navigation, and clears selection when entering and leaving descendants', async () => {
    const { service } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects',
      restrictToDefaultDir: true
    })
    fireEvent.click(await waitForRow('invoice'))
    expect(screen.getByTestId('documents-btn')).not.toBeDisabled()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'My Drive'
    ])
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByRole(
        'button',
        { name: 'My Drive' }
      )
    ).toBe(null)
    fireEvent.doubleClick(getRow('child'))
    await waitForRow('nested')
    expect(screen.getByTestId('documents-btn')).toBeDisabled()
    fireEvent.click(await screen.findByRole('button', { name: 'Projects' }))
    await waitForRow('invoice')
    expect(screen.getByTestId('documents-btn')).toBeDisabled()
    expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    expect(service.throw).not.toHaveBeenCalled()
  })

  it('keeps restricted navigation and confirmation inside a freshly renamed root', async () => {
    const { service, documents } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects',
      restrictToDefaultDir: true
    })
    await waitForRow('child')
    documents.set('projects', {
      ...projects,
      name: 'Renamed',
      path: '/Renamed'
    })
    documents.set('child', { ...child, path: '/Renamed/Child' })

    fireEvent.doubleClick(getRow('child'))
    await confirmDocument('nested')

    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...nested, path: '/Renamed/Child/nested.pdf' }
    ])
    expect(screen.queryByTestId('file-picker-error')).toBe(null)
  })

  it('does not navigate into a listed folder that moved outside the restricted subtree', async () => {
    const { documents, client } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects',
      restrictToDefaultDir: true
    })
    await waitForRow('child')
    documents.set('child', { ...child, dir_id: ROOT_DIR_ID, path: '/Child' })
    fireEvent.doubleClick(getRow('child'))
    await waitFor(() =>
      expect(client.getDocumentFromState('io.cozy.files', 'child').dir_id).toBe(
        ROOT_DIR_ID
      )
    )
    expect(screen.getByTestId('documents-btn')).toBeDisabled()
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByRole(
        'button',
        { name: 'My Drive' }
      )
    ).toBe(null)
    expect(getRow('nested')).toBe(null)
    expect(getRow('invoice')).toBeInTheDocument()
  })

  it('refuses confirmation when a selected file moved outside the restricted root', async () => {
    const { service, documents } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects',
      restrictToDefaultDir: true
    })
    fireEvent.click(await waitForRow('invoice'))
    documents.set('invoice', { ...invoice, dir_id: ROOT_DIR_ID })
    fireEvent.click(screen.getByTestId('documents-btn'))
    expect(await screen.findByTestId('file-picker-error')).toBeInTheDocument()
    expect(service.terminate).not.toHaveBeenCalled()
  })

  it.each([
    { tabs: [] },
    { tabs: ['unknown'] },
    { tabs: null },
    { restrictToDefaultDir: true },
    { defaultDirId: 'missing', restrictToDefaultDir: true },
    { defaultDirId: 'projects', restrictToDefaultDir: true, tabs: ['recents'] },
    {
      defaultDirId: 'projects',
      restrictToDefaultDir: true,
      tabs: ['drive', 'sharings']
    },
    { defaultDirId: 'invoice', restrictToDefaultDir: true }
  ])(
    'reports invalid or unverifiable restricted configuration through the generic error channel: %j',
    async config => {
      const { service } = setup({ ...onlyDocuments, ...config })
      await waitFor(() => expect(service.throw).toHaveBeenCalledTimes(1))
      expect(service.throw.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(screen.queryByTestId('file-picker')).toBe(null)
      expect(service.notifyReadyToUse).not.toHaveBeenCalled()
    }
  )

  it('displays the picker when a valid restricted root warm-up prefetch fails', async () => {
    const { service } = setup(
      {
        ...onlyDocuments,
        defaultDirId: 'projects',
        restrictToDefaultDir: true
      },
      { rejectWarmupListing: true }
    )
    await waitFor(() =>
      expect(screen.getByTestId('file-picker')).toBeInTheDocument()
    )
    expect(service.throw).not.toHaveBeenCalled()
  })

  it('falls back visibly to Drive root when a nonrestricted starting folder is unavailable', async () => {
    const { service } = setup({ ...onlyDocuments, defaultDirId: 'missing' })
    await waitForRow('projects')
    expect(getRow('invoice')).toBe(null)
    await waitFor(() =>
      expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    )
    expect(service.throw).not.toHaveBeenCalled()
  })

  it('evaluates accept independently for each action without hiding files or preventing folder navigation', async () => {
    setup({
      defaultDirId: 'projects',
      documents: { accept: ['folder'] },
      sharingLink: { accept: ['file'] },
      downloadLink: { accept: ['folder'] }
    })
    fireEvent.click(await waitForRow('invoice'))
    expect(screen.getByTestId('documents-btn')).toBeDisabled()
    expect(screen.getByTestId('public-link-btn')).not.toBeDisabled()
    expect(screen.getByTestId('temporary-download-link-btn')).toBeDisabled()
    fireEvent.click(getRow('child'))
    expect(screen.getByTestId('documents-btn')).not.toBeDisabled()
    expect(screen.getByTestId('public-link-btn')).toBeDisabled()
    expect(screen.getByTestId('temporary-download-link-btn')).toBeDisabled()
    expect(getRow('invoice')).toBeInTheDocument()
    fireEvent.doubleClick(getRow('child'))
    await waitForRow('nested')
  })

  it('keeps path resolution business failures in the picker instead of returning an incomplete path', async () => {
    const { service, documents, writes } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects'
    })
    await waitForRow('invoice')
    documents.set('projects', { ...projects, path: null })
    await confirmDocument('invoice')
    expect(await screen.findByTestId('file-picker-error')).toHaveTextContent(
      'Could not retrieve the selected documents and their paths.'
    )
    expect(service.terminate).not.toHaveBeenCalled()
    expect(service.throw).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('preserves the legacy temporary-download result instead of returning a Documents entry', async () => {
    const sharedFile = { ...invoice, driveId: 'shared-drive' }
    const { service, documents, client } = setup(
      { tabs: ['recents'], sharingLink: null },
      { recents: [sharedFile] }
    )
    documents.set('shared-drive/invoice', invoice)
    client.getStackClient().setUri('https://alice.example')
    jest.spyOn(client.getStackClient(), 'fetchJSON').mockResolvedValue({
      links: { related: 'https://download.example/invoice.pdf' }
    })
    fireEvent.click(await waitForRow('invoice'))
    fireEvent.click(screen.getByTestId('temporary-download-link-btn'))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      {
        id: 'invoice',
        name: 'invoice.pdf',
        size: 42,
        mimeType: 'application/pdf',
        downloadLink: 'https://download.example/invoice.pdf',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      }
    ])
    expect(service.terminate.mock.calls[0][0][0]).not.toHaveProperty('path')
    expect(service.terminate.mock.calls[0][0][0]).not.toHaveProperty('_id')
  })

  it.each(['local', 'shared'])(
    'keeps folders unavailable as attachments in the %s scope despite explicit accept',
    async scope => {
      const folder = {
        ...child,
        ...(scope === 'shared' ? { driveId: 'shared-drive' } : {})
      }
      const { service, writes } = setup(
        {
          tabs: ['recents'],
          sharingLink: null,
          downloadLink: { accept: ['folder'], allowFolder: true }
        },
        { recents: [folder] }
      )
      fireEvent.click(await waitForRow('child'))
      const downloadButton = screen.getByTestId('temporary-download-link-btn')
      expect(downloadButton).toBeDisabled()
      fireEvent.click(downloadButton)
      expect(service.terminate).not.toHaveBeenCalled()
      expect(writes).toEqual([])
      expect(screen.queryByTestId('file-picker-error')).toBe(null)
    }
  )

  it('rejects a folder refreshed at attachment confirmation before creating permissions', async () => {
    const { service, documents, writes } = setup({
      defaultDirId: 'projects',
      sharingLink: null,
      downloadLink: { accept: ['file', 'folder'] }
    })
    fireEvent.click(await waitForRow('invoice'))
    expect(screen.getByTestId('temporary-download-link-btn')).not.toBeDisabled()
    documents.set('invoice', { ...invoice, type: 'directory' })
    fireEvent.click(screen.getByTestId('temporary-download-link-btn'))
    expect(await screen.findByTestId('file-picker-error')).toBeInTheDocument()
    expect(service.terminate).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('uses the correct Shared Drive parent path rather than the local parent with the same ID', async () => {
    const sharedFile = {
      ...invoice,
      driveId: 'shared-drive',
      dir_id: 'projects'
    }
    const { service, documents } = setup(
      { ...onlyDocuments, tabs: ['recents'] },
      { recents: [sharedFile] }
    )
    documents.set('shared-drive/invoice', invoice)
    documents.set('shared-drive/projects', { ...projects, path: '/Team' })
    await confirmDocument('invoice')
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...invoice, driveId: 'shared-drive', path: '/Team/invoice.pdf' }
    ])
  })

  it.each([
    ['trashed folder', 'trashed-folder'],
    ['nested trashed folder', 'nested-trashed'],
    ['explicit trash root', TRASH_DIR_ID]
  ])(
    'falls back visibly to Drive root when nonrestricted defaultDirId points to %s',
    async (_, defaultDirId) => {
      const { service } = setup({ ...onlyDocuments, defaultDirId })
      await waitForRow('projects')
      expect(getRow('invoice')).toBe(null)
      expect(getRow('TrashedFolder')).toBe(null)
      await waitFor(() =>
        expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
      )
      expect(service.throw).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['trashed folder', 'trashed-folder'],
    ['nested trashed folder', 'nested-trashed'],
    ['explicit trash root', TRASH_DIR_ID]
  ])(
    'reports error through generic error channel when restricted defaultDirId points to %s',
    async (_, defaultDirId) => {
      const { service } = setup({
        ...onlyDocuments,
        defaultDirId,
        restrictToDefaultDir: true
      })
      await waitFor(() => expect(service.throw).toHaveBeenCalledTimes(1))
      expect(service.throw.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(screen.queryByTestId('file-picker')).toBe(null)
      expect(service.notifyReadyToUse).not.toHaveBeenCalled()
    }
  )

  it('rejects a folder moved to trash after selection instead of returning a deleted document', async () => {
    const { service, documents } = setup({
      documents: { accept: ['folder'] },
      sharingLink: null,
      downloadLink: null,
      defaultDirId: 'projects'
    })
    fireEvent.click(await waitForRow('child'))
    documents.set('child', {
      ...child,
      path: `${TRASH_DIR_PATH}/Child`,
      dir_id: TRASH_DIR_ID,
      restore_path: '/Projects/Child'
    })
    fireEvent.click(screen.getByTestId('documents-btn'))
    expect(await screen.findByTestId('file-picker-error')).toBeInTheDocument()
    expect(service.terminate).not.toHaveBeenCalled()
  })

  it('allows starting in and navigating a healthy folder whose name includes "trash"', async () => {
    const { service } = setup({
      ...onlyDocuments,
      defaultDirId: 'trash-archive',
      restrictToDefaultDir: true
    })
    await waitForRow('trash-archive-child')
    expect(service.throw).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    )
  })
})

describe('MOVE intent navigation integration', () => {
  afterEach(() => jest.clearAllMocks())

  function setupMove(data = {}, options = {}) {
    const context = setup(
      { fileIds: ['invoice'], ...data },
      { action: 'MOVE', ...options }
    )
    const { documents, writes, client } = context
    const failedIds = new Set()
    client.collection = () => ({
      updateFileMetadata: async (id, attributes) => {
        if (failedIds.has(id)) throw new Error('Move unavailable')
        const file = documents.get(id)
        const conflict = [...documents.values()].find(
          item =>
            item._id !== id &&
            !item.trashed &&
            item.dir_id === attributes.dir_id &&
            item.name === file.name
        )
        if (conflict)
          throw Object.assign(new Error('Name conflict'), { status: 409 })
        const moved = { ...file, ...attributes, _rev: `${file._rev}-moved` }
        documents.set(id, moved)
        writes.push({ id, attributes })
        return { data: { ...moved } }
      },
      statByPath: async path => ({
        data: [...documents.values()].find(
          file =>
            !file.trashed &&
            `${documents.get(file.dir_id)?.path.replace(/\/+$/, '')}/${file.name}` ===
              path
        )
      }),
      destroy: async file => {
        documents.set(file._id, { ...file, trashed: true })
        return { data: file }
      }
    })
    return { ...context, failedIds }
  }

  it.each(['Cancel', 'Close'])(
    'reuses shared destination browsing, canonical Drive/Sharings tabs and cancels via %s without mutating',
    async closeLabel => {
      const { service, documents, writes } = setupMove({
        tabs: ['sharings', 'drive', 'sharings']
      })
      await waitForRow('projects')
      expect(screen.queryByTestId('move-intent')).toBeInTheDocument()
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'My Drive',
        'Sharings'
      ])
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Move' })).not.toBeDisabled()
      )
      expect(
        screen.queryByRole('button', { name: /create folder/i })
      ).toBeInTheDocument()
      fireEvent.doubleClick(getRow('projects'))
      await waitForRow('child')
      const invoiceRow = await waitForRow('invoice')
      expect(invoiceRow).toHaveAttribute('aria-disabled', 'true')
      expect(invoiceRow).toHaveClass('u-c-default', 'u-o-50')
      fireEvent.click(invoiceRow)
      fireEvent.doubleClick(invoiceRow)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Move' })).not.toBeDisabled()
      )
      expect(documents.get('invoice').dir_id).toBe('projects')
      expect(writes).toEqual([])
      expect(service.terminate).not.toHaveBeenCalled()
      expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
      fireEvent.click(
        within(screen.getByTestId('move-intent')).getByRole('button', {
          name: closeLabel
        })
      )
      expect(service.cancel).toHaveBeenCalledWith()
    }
  )

  it('disables its close cross during destination validation', async () => {
    let blockValidation = false
    let resolveValidation
    const validation = new Promise(resolve => {
      resolveValidation = resolve
    })
    const { service, documents } = setupMove(
      {},
      {
        beforeRead: id =>
          blockValidation && id === ROOT_DIR_ID ? validation : null
      }
    )
    await waitForRow('projects')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
    )
    blockValidation = true
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))
    const closeButton = screen.getByRole('button', { name: 'Close' })
    expect(closeButton).toBeDisabled()
    fireEvent.click(closeButton)
    expect(service.cancel).not.toHaveBeenCalled()
    expect(documents.get('invoice').dir_id).toBe('projects')
    resolveValidation()
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(documents.get('invoice').dir_id).toBe(ROOT_DIR_ID)
  })

  it('warns for a later shared source parent even when the first source is private', async () => {
    const other = {
      ...projects,
      _id: 'other',
      id: 'other',
      name: 'Other',
      path: '/Other'
    }
    const privateFile = {
      ...invoice,
      _id: 'private',
      id: 'private',
      dir_id: 'other',
      name: 'private.pdf'
    }
    const { service, documents, writes } = setupMove(
      { fileIds: ['private', 'invoice'] },
      {
        files: [root, projects, other, invoice, privateFile],
        sharing: {
          sharedPaths: ['/Projects'],
          getSharedParentPath: path =>
            path.startsWith('/Projects/') ? '/Projects' : null,
          hasSharedParent: path => path.startsWith('/Projects/')
        }
      }
    )
    await waitForRow('projects')
    await clickMove()
    await screen.findByRole('button', { name: 'I understand' })
    expect(
      screen.queryByText('Moving outside the Projects folder')
    ).toBeInTheDocument()
    expect(documents.get('private').dir_id).toBe('other')
    expect(documents.get('invoice').dir_id).toBe('projects')
    expect(writes).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(documents.get('private').dir_id).toBe(ROOT_DIR_ID)
    expect(documents.get('invoice').dir_id).toBe(ROOT_DIR_ID)
    expect(service.terminate.mock.calls[0][0].map(file => file.path)).toEqual([
      '/private.pdf',
      '/invoice.pdf'
    ])
  })

  it('moves through the real model and returns the mutation document with a freshly resolved path', async () => {
    const { service, documents, writes, requests } = setupMove()
    await waitForRow('projects')
    await clickMove()
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(documents.get('invoice').dir_id).toBe(ROOT_DIR_ID)
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...documents.get('invoice'), path: '/invoice.pdf' }
    ])
    expect(writes).toHaveLength(1)
    expect(requests.filter(query => query.id === 'invoice')).toHaveLength(1)
  })

  it('retains successful mutation results across a failed-only retry from different parents', async () => {
    const { service, documents, writes, failedIds } = setupMove({
      fileIds: ['invoice', 'nested']
    })
    failedIds.add('nested')
    await waitForRow('projects')
    await clickMove()
    await screen.findByText('Moved: 1. Failed: 1.')
    const firstMoved = documents.get('invoice')
    expect(firstMoved.dir_id).toBe(ROOT_DIR_ID)
    expect(documents.get('nested').dir_id).toBe('child')
    expect(service.terminate).not.toHaveBeenCalled()
    failedIds.clear()
    await clickMove()
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(documents.get('invoice')).toBe(firstMoved)
    expect(writes.map(write => write.id)).toEqual(['invoice', 'nested'])
    expect(
      service.terminate.mock.calls[0][0].map(document => document.path)
    ).toEqual(['/invoice.pdf', '/nested.pdf'])
  })

  it('returns only surviving selected files when a same-name move replaces an earlier selected file', async () => {
    const second = {
      ...invoice,
      _id: 'second',
      id: 'second',
      dir_id: 'child',
      metadata: { author: 'Bob' }
    }
    const { service, documents, writes } = setupMove(
      { fileIds: ['invoice', 'second'] },
      { files: [root, projects, child, invoice, second] }
    )
    await waitForRow('projects')
    await clickMove()
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(documents.get('invoice').trashed).toBe(true)
    expect(documents.get('second').dir_id).toBe(ROOT_DIR_ID)
    expect(writes.map(write => write.id)).toEqual(['invoice', 'second'])
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...documents.get('second'), path: '/invoice.pdf' }
    ])
  })

  it('retries only finalization after the mutation succeeded but a parent read failed', async () => {
    let failResult = true
    let context
    context = setupMove(
      {},
      {
        beforeRead: id => {
          if (
            failResult &&
            id === ROOT_DIR_ID &&
            context.documents.get('invoice').dir_id === ROOT_DIR_ID
          )
            throw new Error('Final parent unavailable')
        }
      }
    )
    const { service, documents, writes } = context
    await waitForRow('projects')
    await clickMove()
    await screen.findByText(
      'Could not retrieve the selected documents and their paths.'
    )
    const moved = documents.get('invoice')
    expect(moved.dir_id).toBe(ROOT_DIR_ID)
    expect(writes).toHaveLength(1)
    expect(service.terminate).not.toHaveBeenCalled()
    expect(service.throw).not.toHaveBeenCalled()
    failResult = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(documents.get('invoice')).toBe(moved)
    expect(writes).toHaveLength(1)
    expect(service.terminate.mock.calls[0][0]).toEqual([
      { ...moved, path: '/invoice.pdf' }
    ])
  })

  it.each(['Cancel', 'Close'])(
    'cancels via %s after a partial move without undoing the successful file',
    async closeLabel => {
      const { service, documents, failedIds } = setupMove({
        fileIds: ['invoice', 'nested']
      })
      failedIds.add('nested')
      await waitForRow('projects')
      await clickMove()
      await screen.findByText('Moved: 1. Failed: 1.')
      fireEvent.click(
        within(screen.getByTestId('move-intent')).getByRole('button', {
          name: closeLabel
        })
      )
      expect(service.cancel).toHaveBeenCalledWith()
      expect(service.terminate).not.toHaveBeenCalled()
      expect(documents.get('invoice').dir_id).toBe(ROOT_DIR_ID)
      expect(documents.get('nested').dir_id).toBe('child')
    }
  )

  it('waits for the current folder resolver even when the listing is already usable', async () => {
    let resolveRoot
    const rootRead = new Promise(resolve => {
      resolveRoot = resolve
    })
    const { service } = setupMove(
      {},
      {
        beforeRead: id => (id === ROOT_DIR_ID ? rootRead : null)
      }
    )
    await waitForRow('projects')
    expect(service.notifyReadyToUse).not.toHaveBeenCalled()
    resolveRoot()
    await waitFor(() =>
      expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled()
  })

  it('keeps restricted MOVE navigation usable after the starting folder warm-up fails', async () => {
    const { service, documents, writes } = setupMove(
      { defaultDirId: 'projects', restrictToDefaultDir: true },
      { rejectWarmupListing: true }
    )
    await waitForRow('child')
    expect(screen.queryByTestId('move-intent')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'My Drive'
    ])
    expect(getRow('projects')).toBe(null)
    const invoiceRow = await waitForRow('invoice')
    expect(invoiceRow).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByRole(
        'button',
        { name: 'My Drive' }
      )
    ).toBe(null)
    fireEvent.doubleClick(getRow('child'))
    const nestedRow = await waitForRow('nested')
    expect(nestedRow).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }))
    await waitForRow('child')
    expect(documents.get('invoice').dir_id).toBe('projects')
    expect(writes).toEqual([])
    expect(service.throw).not.toHaveBeenCalled()
    expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(service.cancel).toHaveBeenCalledWith()
  })

  it('applies a starting folder without restricting navigation and preserves the explicit theme', async () => {
    const { service } = setupMove({
      defaultDirId: 'projects',
      theme: { type: 'dark' }
    })
    await waitForRow('child')
    expect(document.querySelector('.TwakeTheme--dark')).not.toBe(null)
    fireEvent.click(screen.getByRole('button', { name: 'My Drive' }))
    await waitForRow('projects')
    expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
  })

  it('restricts destinations, not source locations, and anchors breadcrumbs after descendant navigation', async () => {
    const { service, writes } = setupMove(
      {
        defaultDirId: 'projects',
        restrictToDefaultDir: true,
        fileIds: ['outside']
      },
      {
        files: [
          root,
          projects,
          child,
          invoice,
          { ...nested, _id: 'outside', id: 'outside', dir_id: ROOT_DIR_ID }
        ]
      }
    )
    await waitForRow('child')
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'My Drive'
    ])
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByRole(
        'button',
        { name: 'My Drive' }
      )
    ).toBe(null)
    fireEvent.doubleClick(getRow('child'))
    await waitFor(() =>
      expect(screen.queryByTestId('file-picker-empty')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }))
    await waitForRow('child')
    expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    expect(service.throw).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('rechecks ancestry before entering a listed folder that moved outside the restriction', async () => {
    const { documents, client } = setupMove({
      defaultDirId: 'projects',
      restrictToDefaultDir: true
    })
    await waitForRow('child')
    documents.set('child', { ...child, dir_id: ROOT_DIR_ID, path: '/Child' })
    fireEvent.doubleClick(getRow('child'))
    await waitFor(() =>
      expect(client.getDocumentFromState('io.cozy.files', 'child').dir_id).toBe(
        ROOT_DIR_ID
      )
    )
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByText('Child')
    ).toBe(null)
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByText(
        'Projects'
      )
    ).toBeInTheDocument()
  })

  it('does not enter a read-only destination', async () => {
    setupMove({}, { hasWriteAccess: id => id !== 'projects' })
    const row = await waitForRow('projects')
    expect(row).toHaveAttribute('aria-disabled', 'true')
    fireEvent.doubleClick(row)
    expect(getRow('child')).toBe(null)
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByText(
        'Projects'
      )
    ).toBe(null)
  })

  it('falls back to root when the unrestricted initial folder cannot be resolved', async () => {
    const { service } = setupMove({ defaultDirId: 'missing' })
    await waitForRow('projects')
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByText(
        'My Drive'
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    )
    expect(service.throw).not.toHaveBeenCalled()
  })

  it.each([
    { fileIds: undefined },
    { fileIds: null },
    { fileIds: [] },
    { fileIds: [42] },
    { fileIds: [''] },
    { fileIds: ['missing'] },
    { fileIds: ['projects'] },
    { tabs: [] },
    { tabs: ['sharings'] },
    { tabs: ['drive', 'recents'] },
    { tabs: ['unknown'] },
    { tabs: null },
    { restrictToDefaultDir: true },
    { restrictToDefaultDir: true, defaultDirId: 'missing' },
    { restrictToDefaultDir: true, defaultDirId: 'invoice' },
    {
      restrictToDefaultDir: true,
      defaultDirId: 'projects',
      tabs: ['drive', 'sharings']
    }
  ])(
    'rejects unusable MOVE configuration without exposing a browser or readiness: %j',
    async config => {
      const { service, writes, documents } = setupMove(config)
      await waitFor(() => expect(service.throw).toHaveBeenCalledTimes(1))
      expect(service.throw.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(screen.queryByTestId('move-intent')).toBe(null)
      expect(service.notifyReadyToUse).not.toHaveBeenCalled()
      expect(service.terminate).not.toHaveBeenCalled()
      expect(documents.get('invoice').dir_id).toBe('projects')
      expect(writes).toEqual([])
    }
  )

  it.each([
    { driveId: 'remote' },
    { trashed: true },
    { _deleted: true },
    { _type: 'io.cozy.nextcloud.files' },
    { cozyMetadata: { createdByApp: 'nextcloud' } }
  ])(
    'refuses non-local or deleted sources before exposing navigation: %j',
    async attributes => {
      const { service, writes } = setupMove(
        {},
        { files: [root, projects, { ...invoice, ...attributes }] }
      )
      await waitFor(() => expect(service.throw).toHaveBeenCalledTimes(1))
      expect(screen.queryByTestId('move-intent')).toBe(null)
      expect(service.notifyReadyToUse).not.toHaveBeenCalled()
      expect(writes).toEqual([])
    }
  )
})
