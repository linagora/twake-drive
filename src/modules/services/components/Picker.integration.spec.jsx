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
import { SharingProvider } from 'cozy-sharing/dist/SharingProvider'

import IntentHandler from './IntentHandler'
import AppLike from 'test/components/AppLike'

import { ROOT_DIR_ID } from '@/constants/config'

const mockCreateService = jest.fn()
const mockGetIntent = jest.fn()

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
const onlyDocuments = { documents: {}, sharingLink: null, downloadLink: null }

function setup(
  data = {},
  {
    files = [root, projects, child, invoice, nested],
    recents = [],
    simulatePermissions = false
  } = {}
) {
  const documents = new Map(files.map(file => [file._id, { ...file }]))
  const requests = []
  const writes = []
  const client = new CozyClient({
    links: [
      {
        request: async operation => {
          if (operation.mutationType) {
            writes.push(operation)
            throw new Error('PICK must not save response-only paths')
          }
          requests.push(operation)
          if (operation.id) {
            const file = documents.get(
              operation.sharingId
                ? `${operation.sharingId}/${operation.id}`
                : operation.id
            )
            if (!file) throw new Error('Document not found')
            return { data: { ...file } }
          }
          return {
            data:
              operation.doctype === 'io.cozy.files'
                ? [...documents.values()].filter(
                    file => file.dir_id === operation.selector?.dir_id
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
    attributes: { action: 'PICK', type: 'io.cozy.files', data }
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
  render(
    <AppLike
      client={client}
      sharingContextValue={{
        allLoaded: true,
        byDocId: {},
        isOwner: () => true,
        ensureSharingLink: sharingProvider?.ensureSharingLink
      }}
    >
      <IntentHandler intentId="intent-id" />
    </AppLike>
  )
  return { client, service, documents, requests, writes, permissions }
}

function getRow(id) {
  return (
    screen
      .queryAllByTestId('list-item')
      .find(row => row.getAttribute('data-file-id') === id) ?? null
  )
}

async function waitForRow(id) {
  await waitFor(() => expect(getRow(id)).toBeInTheDocument())
  return getRow(id)
}

describe('PICK intent integration', () => {
  afterEach(() => jest.clearAllMocks())

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

  it('rechecks action-specific accept on refreshed link documents before generating any link', async () => {
    const { service, documents, writes } = setup({
      defaultDirId: 'projects',
      sharingLink: null,
      downloadLink: { accept: ['application/pdf'] }
    })
    fireEvent.click(await waitForRow('invoice'))
    documents.set('invoice', { ...invoice, mime: 'image/png' })
    fireEvent.click(screen.getByTestId('temporary-download-link-btn'))
    expect(await screen.findByTestId('file-picker-error')).toBeInTheDocument()
    expect(service.terminate).not.toHaveBeenCalled()
    expect(writes).toEqual([])
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

  it('anchors restricted breadcrumbs and navigation when entering and leaving descendants', async () => {
    const { service } = setup({
      ...onlyDocuments,
      defaultDirId: 'projects',
      restrictToDefaultDir: true
    })
    fireEvent.click(await waitForRow('invoice'))
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
    fireEvent.click(await screen.findByRole('button', { name: 'Projects' }))
    await waitForRow('invoice')
    expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    expect(service.throw).not.toHaveBeenCalled()
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
    expect(
      within(screen.getByTestId('file-picker-breadcrumb')).queryByRole(
        'button',
        { name: 'My Drive' }
      )
    ).toBe(null)
    expect(getRow('nested')).toBe(null)
    expect(getRow('invoice')).toBeInTheDocument()
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

  it('falls back visibly to Drive root when a nonrestricted starting folder is unavailable', async () => {
    const { service } = setup({ ...onlyDocuments, defaultDirId: 'missing' })
    await waitForRow('projects')
    expect(getRow('invoice')).toBe(null)
    await waitFor(() =>
      expect(service.notifyReadyToUse).toHaveBeenCalledTimes(1)
    )
    expect(service.throw).not.toHaveBeenCalled()
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
})
