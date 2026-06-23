import { renderHook, waitFor } from '@testing-library/react'

import { useClient } from 'cozy-client'
import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'

import { useCreateFile } from './useCreateFile'

jest.mock('cozy-client', () => ({
  useClient: jest.fn()
}))
jest.mock('cozy-client/dist/models/file', () => ({
  uploadFileWithConflictStrategy: jest.fn()
}))
jest.mock('twake-i18n', () => ({
  useI18n: () => ({ t: key => key })
}))
jest.mock('@/lib/logger', () => ({ error: jest.fn() }))

describe('useCreateFile', () => {
  const client = {
    getStackClient: () => ({ uri: 'http://cozy.test' })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useClient.mockReturnValue(client)
  })

  it('should upload an empty .excalidraw file and expose its id once loaded', async () => {
    uploadFileWithConflictStrategy.mockResolvedValue({
      data: { id: 'new-file-id' }
    })

    const { result } = renderHook(() => useCreateFile('folder123'))

    await waitFor(() => expect(result.current.status).toBe('loaded'))

    expect(result.current.fileId).toBe('new-file-id')

    const [passedClient, , options] =
      uploadFileWithConflictStrategy.mock.calls[0]
    expect(passedClient).toBe(client)
    expect(options.name).toBe('Excalidraw.createFileName.excalidraw')
    expect(options.dirId).toBe('folder123')
    expect(options.conflictStrategy).toBe('rename')
    expect(options.contentType).toBe('application/vnd.excalidraw+json')
  })

  it('should forward the driveId when creating inside a shared drive', async () => {
    uploadFileWithConflictStrategy.mockResolvedValue({
      data: { id: 'new-file-id' }
    })

    const { result } = renderHook(() => useCreateFile('folder123', 'drive456'))

    await waitFor(() => expect(result.current.status).toBe('loaded'))

    expect(uploadFileWithConflictStrategy.mock.calls[0][2].driveId).toBe(
      'drive456'
    )
  })

  it('should report an error status when the upload fails', async () => {
    uploadFileWithConflictStrategy.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useCreateFile('folder123'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.fileId).toBeNull()
  })
})
