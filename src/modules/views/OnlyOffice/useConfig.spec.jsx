import { renderHook, waitFor } from '@testing-library/react'

import { useClient } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { officeDoc } from 'test/data'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import useConfig from '@/modules/views/OnlyOffice/useConfig'
import { useEditorAuthor } from '@/modules/views/editor/useEditorAuthor'

jest.mock('cozy-client', () => ({
  useClient: jest.fn(),
  isQueryLoading: jest.fn(() => false),
  generateWebLink: jest.fn()
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

// Same instance as the client so the doc is opened locally (no redirect branch).
const officeDocWithoutPublicName = {
  data: {
    ...officeDoc,
    attributes: { ...officeDoc.attributes, public_name: undefined }
  }
}

const setup = ({
  data = officeDocWithoutPublicName,
  author = 'Bob',
  isAuthorLoading = false,
  isPublic = false
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
})
