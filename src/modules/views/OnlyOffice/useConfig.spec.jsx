import { renderHook, waitFor } from '@testing-library/react'

import { useClient } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'
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
  isReadOnly = false
} = {}) => {
  useClient.mockReturnValue({
    getStackClient: () => ({ uri: 'https://bob.cozy.example' })
  })
  useBreakpoints.mockReturnValue({ isDesktop: true })
  useFetchJSON.mockReturnValue({ data, fetchStatus: 'loaded' })
  useEditorAuthor.mockReturnValue({ author, isLoading: isAuthorLoading })
  useOnlyOfficeContext.mockReturnValue({
    fileId: '123',
    driveId: undefined,
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

  it('does not build the config until the editor author is resolved', () => {
    const { result } = setup({ isAuthorLoading: true })

    expect(result.current.config).toBeUndefined()
  })

  it('preserves the editable PDF payload returned by the stack', async () => {
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

  it('forces a read-only Office config to view mode', async () => {
    const { result } = setup({ isReadOnly: true })

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(
      result.current.config.docEditorConfig.document.permissions.edit
    ).toBe(false)
    expect(result.current.config.docEditorConfig.editorConfig.mode).toBe('view')
  })

  it('forces a read-only PDF config to view mode', async () => {
    const { result } = setup({ data: pdfOfficeDoc, isReadOnly: true })

    await waitFor(() => expect(result.current.config).toBeDefined())

    expect(
      result.current.config.docEditorConfig.document.permissions.edit
    ).toBe(false)
    expect(result.current.config.docEditorConfig.editorConfig.mode).toBe('view')
  })

  it('falls back when a PDF reaches OnlyOffice with Office disabled', async () => {
    isOfficeEnabled.mockReturnValue(false)
    const { result } = setup({ data: pdfOfficeDoc })

    await waitFor(() => expect(result.current.status).toBe('error'))

    expect(result.current.config).toBeUndefined()
  })

  it('sends a document the stack resolved elsewhere to its owner', async () => {
    setup({
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
  })
})
