import { renderHook, waitFor } from '@testing-library/react'

import { useClient } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { officeDoc } from 'test/data'

import { changeLocation } from '@/hooks/helpers'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { isOfficeEnabled } from '@/modules/views/OnlyOffice/helpers'
import useConfig from '@/modules/views/OnlyOffice/useConfig'
import { useEditorAuthor } from '@/modules/views/editor/useEditorAuthor'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn(),
  isQueryLoading: jest.fn(() => false)
}))
jest.mock('cozy-client/dist/hooks/useFetchJSON', () => ({
  __esModule: true,
  default: jest.fn()
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: jest.fn()
}))
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams()]
}))
jest.mock('@/modules/views/OnlyOffice/OnlyOfficeProvider', () => ({
  useOnlyOfficeContext: jest.fn()
}))
jest.mock('@/modules/views/editor/useEditorAuthor', () => ({
  useEditorAuthor: jest.fn()
}))
jest.mock('@/modules/views/OnlyOffice/helpers', () => ({
  ...jest.requireActual('@/modules/views/OnlyOffice/helpers'),
  isOfficeEnabled: jest.fn(() => true)
}))
jest.mock('cozy-flags')
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: jest.fn() }
}))
jest.mock('@/hooks/helpers', () => ({
  ...jest.requireActual('@/hooks/helpers'),
  changeLocation: jest.fn()
}))

// Same instance as the client so the doc is opened locally (no redirect branch).
const officeDocWithoutPublicName = {
  data: {
    ...officeDoc,
    attributes: { ...officeDoc.attributes, public_name: undefined }
  }
}

const pdfOfficeDoc = {
  data: {
    ...officeDoc,
    class: 'pdf',
    name: 'Contract.pdf',
    attributes: {
      ...officeDoc.attributes,
      onlyoffice: {
        ...officeDoc.attributes.onlyoffice,
        documentType: 'pdf',
        document: {
          ...officeDoc.attributes.onlyoffice.document,
          fileType: 'pdf',
          title: 'Contract.pdf',
          permissions: { edit: true }
        }
      }
    }
  }
}

const setup = ({
  data = officeDocWithoutPublicName,
  author = 'Bob',
  isAuthorLoading = false,
  isPublic = false,
  isReadOnly = false,
  driveId = null,
  sharing = null,
  serverUrl = data.data.attributes.onlyoffice?.url
} = {}) => {
  useClient.mockReturnValue({
    getStackClient: () => ({ uri: 'https://bob.cozy.example' })
  })
  useBreakpoints.mockReturnValue({ isDesktop: true })
  useFetchJSON.mockReturnValue({
    data: {
      data: {
        ...data.data,
        attributes: {
          ...data.data.attributes,
          onlyoffice: { ...data.data.attributes.onlyoffice, url: serverUrl }
        }
      }
    },
    fetchStatus: 'loaded'
  })
  useSharingContext.mockReturnValue({
    getSharingById: id => (id === driveId ? sharing : null)
  })
  useEditorAuthor.mockReturnValue({ author, isLoading: isAuthorLoading })
  useOnlyOfficeContext.mockReturnValue({
    fileId: '123',
    driveId,
    setIsEditorReady: jest.fn(),
    isPublic,
    isReadOnly,
    username: undefined,
    isFromSharing: false,
    editorMode: 'edit',
    isEditorModeView: false,
    setOfficeKey: jest.fn()
  })

  return renderHook(() => useConfig())
}

describe('useConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    isOfficeEnabled.mockReturnValue(true)
  })

  it('sets the OnlyOffice username from the resolved editor author, even when the office open response has no public_name', async () => {
    const { result } = setup({ author: 'Bob' })

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(result.current.config.docEditorConfig.editorConfig.user.name).toBe(
      'Bob'
    )
  })

  it.each([
    { driveId: null, sharing: null },
    { driveId: 'owned-drive', sharing: { attributes: { owner: true } } }
  ])(
    'preserves the locally configured OnlyOffice prefix for $driveId',
    async options => {
      const { result } = setup({
        ...options,
        serverUrl: 'https://proxy.example/onlyoffice/?ignored#ignored'
      })

      await waitFor(() => expect(result.current.config).toBeDefined())

      expect(result.current.config.apiUrl).toBe(
        'https://proxy.example/onlyoffice/web-apps/apps/api/documents/api.js'
      )
      expect(result.current.config.serverUrl).toBe('https://proxy.example')
    }
  )

  it('discards a received drive URL path even when the response claims to be local', async () => {
    const { result } = setup({
      driveId: 'received-drive',
      sharing: { attributes: { owner: false } },
      serverUrl: 'https://bob.cozy.example/sharings/drives/x/downloads/y/p.js?'
    })

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(result.current.config.apiUrl).toBe(
      'https://bob.cozy.example/web-apps/apps/api/documents/api.js'
    )
  })

  it('waits for drive ownership before building the config', async () => {
    const { result, rerender } = setup({
      driveId: 'owned-drive',
      serverUrl: 'https://proxy.example/onlyoffice'
    })

    expect(result.current.config).toBeUndefined()

    useSharingContext.mockReturnValue({
      getSharingById: () => ({ attributes: { owner: true } })
    })
    rerender()

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(result.current.config.apiUrl).toBe(
      'https://proxy.example/onlyoffice/web-apps/apps/api/documents/api.js'
    )
  })

  it.each(['javascript:alert(1)//', 'data:text/javascript,alert(1)'])(
    'rejects an invalid locally configured URL: %s',
    async serverUrl => {
      const { result } = setup({ serverUrl })

      await waitFor(() => expect(result.current.status).toBe('error'))

      expect(result.current.config).toBeUndefined()
    }
  )

  it('does not build the config until the editor author is resolved', () => {
    const { result } = setup({ isAuthorLoading: true })

    expect(result.current.config).toBeUndefined()
  })

  it('preserves the editable PDF payload returned by the stack', async () => {
    flag.mockImplementation(
      name => name === 'drive.onlyoffice.pdf-editing.enabled'
    )
    const { result } = setup({ data: pdfOfficeDoc })

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(result.current.config.docEditorConfig).toEqual(
      expect.objectContaining({
        documentType: 'pdf',
        document: expect.objectContaining({
          fileType: 'pdf',
          permissions: { edit: true }
        }),
        editorConfig: expect.objectContaining({
          mode: 'edit',
          callbackUrl: officeDoc.attributes.onlyoffice.editor.callbackUrl
        })
      })
    )
  })

  it('selects the viewer when PDF editing via OnlyOffice is disabled', async () => {
    flag.mockReturnValue(false)
    const { result } = setup({ data: pdfOfficeDoc })

    await waitFor(() => expect(result.current.status).toBe('viewer'))

    expect(result.current.config).toBeUndefined()
  })

  it('leaves out the AI plugin of OnlyOffice when the assistant of Twake is on', async () => {
    flag.mockImplementation(name => name === 'cozy.assistant.enabled')
    const { result } = setup()

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(result.current.config.docEditorConfig.editorConfig.plugins).toEqual({
      disable: ['asc.{9DC93CDB-B576-4F0C-B55E-FCC9C48DD007}']
    })
  })

  it('keeps the AI plugin of OnlyOffice without the assistant of Twake', async () => {
    flag.mockReturnValue(false)
    const { result } = setup()

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(result.current.config.docEditorConfig.editorConfig.plugins).toBe(
      undefined
    )
  })

  it('sets read-only Office documents to view mode', async () => {
    const { result } = setup({ isReadOnly: true })

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(result.current.config.docEditorConfig.editorConfig.mode).toBe('view')
  })

  it('selects the viewer without treating disabled Office as an error', async () => {
    isOfficeEnabled.mockReturnValue(false)
    const { result } = setup({ data: pdfOfficeDoc })

    await waitFor(() => expect(result.current.status).toBe('viewer'))

    expect(result.current.config).toBeUndefined()
  })

  it.each([null, 'received-drive'])(
    'sends a document resolved elsewhere to its owner before loading sharing %s',
    async driveId => {
      setup({
        driveId,
        data: {
          data: {
            ...officeDoc,
            attributes: {
              ...officeDoc.attributes,
              protocol: 'https',
              instance: 'alice.cozy.example',
              subdomain: 'flat',
              sharecode: 'abc123',
              public_name: 'Bob',
              document_id: 'owner-file-id'
            }
          }
        }
      })

      await waitFor(() =>
        expect(changeLocation).toHaveBeenCalledWith(
          'https://alice-drive.cozy.example/public/?sharecode=abc123&isOnlyOfficeDocShared=true&onlyOfficeDocId=owner-file-id&username=Bob#/'
        )
      )
    }
  )
})
