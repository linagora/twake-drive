import { act, render, waitFor } from '@testing-library/react'
import React from 'react'

import { errorSerializer as errors } from 'cozy-interapp/dist/helpers'

import { Upload } from './Upload'

import { uploadFileFromUrl } from '@/modules/services/uploadFromUrl'

const mockClient = {}
jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: () => mockClient
}))
jest.mock('@/modules/services/uploadFromUrl', () => ({
  ...jest.requireActual('@/modules/services/uploadFromUrl'),
  uploadFileFromUrl: jest.fn()
}))

describe('Upload intent service lifecycle', () => {
  afterEach(() => jest.clearAllMocks())

  it('keeps UPLOAD blank and emits one terminal document across rerenders', async () => {
    const document = { _id: 'created-file', name: 'uploaded.bin' }
    const transfer = Promise.withResolvers()
    const data = {
      url: 'https://source.example/file',
      folderId: 'folder',
      name: 'uploaded.bin'
    }
    const service = {
      getData: () => data,
      terminate: jest.fn(),
      throw: jest.fn()
    }
    uploadFileFromUrl.mockReturnValue(transfer.promise)
    const { container, rerender, queryByTestId } = render(
      <React.StrictMode>
        <Upload service={service} />
      </React.StrictMode>
    )
    await waitFor(() => expect(uploadFileFromUrl).toHaveBeenCalledTimes(1))
    rerender(
      <React.StrictMode>
        <Upload service={service} />
      </React.StrictMode>
    )
    expect(container.textContent).toBe('')
    expect(queryByTestId('picker')).toBe(null)
    await act(async () => transfer.resolve(document))
    expect(service.terminate).toHaveBeenCalledTimes(1)
    expect(service.terminate).toHaveBeenCalledWith(document)
    expect(service.throw).not.toHaveBeenCalled()
    expect(uploadFileFromUrl).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe('')
  })

  it.each(['error', 'unmount', 'pagehide'])(
    'handles upload %s without UI or duplicate results',
    async outcome => {
      const failure = Object.assign(new Error('signed-url-secret'), {
        status: 502,
        url: 'https://source.example/?signature=signed-url-secret',
        reason: 'signed-url-secret',
        response: { url: 'signed-url-secret' }
      })
      const transfer = Promise.withResolvers()
      const service = {
        getData: () => ({}),
        terminate: jest.fn(),
        throw: jest.fn()
      }
      uploadFileFromUrl.mockImplementation(async (client, data, signal) => {
        await transfer.promise
        signal.throwIfAborted()
        throw failure
      })
      const { container, unmount } = render(<Upload service={service} />)
      await waitFor(() => expect(uploadFileFromUrl).toHaveBeenCalledTimes(1))
      if (outcome === 'unmount') unmount()
      if (outcome === 'pagehide') window.dispatchEvent(new Event('pagehide'))
      await act(async () => transfer.resolve())
      expect(service.terminate).not.toHaveBeenCalled()
      expect(container.textContent).toBe('')
      if (outcome === 'error') {
        expect(service.throw).toHaveBeenCalledTimes(1)
        expect(errors.serialize(service.throw.mock.calls[0][0])).toEqual({
          name: 'Error',
          message: 'URL upload failed (HTTP 502)',
          status: 502
        })
      } else {
        expect(service.throw).not.toHaveBeenCalled()
        expect(uploadFileFromUrl.mock.calls[0][2].aborted).toBe(true)
      }
    }
  )
})
