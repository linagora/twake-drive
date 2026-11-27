import { act, render, waitFor } from '@testing-library/react'
import React from 'react'

import { Lookup } from './Lookup'

import { lookupReferencedFiles } from '@/modules/services/lookupReferences'

const mockClient = {}
jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: () => mockClient
}))
jest.mock('@/modules/services/lookupReferences', () => ({
  lookupReferencedFiles: jest.fn()
}))

const data = {
  references: [{ type: 'io.cozy.mails.attachments', id: 'a1:e1:b1' }]
}

function makeService() {
  return { getData: () => data, terminate: jest.fn(), throw: jest.fn() }
}

describe('Lookup intent service', () => {
  afterEach(() => jest.clearAllMocks())

  it('shows nothing and answers once with the files found', async () => {
    const result = { files: { 'a1:e1:b1': null } }
    const lookup = Promise.withResolvers()
    lookupReferencedFiles.mockReturnValue(lookup.promise)
    const service = makeService()

    const { container } = render(
      <React.StrictMode>
        <Lookup service={service} />
      </React.StrictMode>
    )
    await waitFor(() => expect(lookupReferencedFiles).toHaveBeenCalledTimes(1))
    expect(lookupReferencedFiles).toHaveBeenCalledWith(mockClient, data)
    await act(async () => lookup.resolve(result))

    expect(container.textContent).toBe('')
    expect(service.terminate).toHaveBeenCalledTimes(1)
    expect(service.terminate).toHaveBeenCalledWith(result)
    expect(service.throw).not.toHaveBeenCalled()
  })

  it('answers an error the caller can receive', async () => {
    lookupReferencedFiles.mockRejectedValue(
      Object.assign(new Error('Unsupported reference'), {
        response: new Response()
      })
    )
    const service = makeService()

    render(<Lookup service={service} />)

    await waitFor(() => expect(service.throw).toHaveBeenCalledTimes(1))
    const [error] = service.throw.mock.calls[0]
    expect(error.message).toBe('Unsupported reference')
    expect(error.response).toBeUndefined()
    expect(service.terminate).not.toHaveBeenCalled()
  })

  it('does not answer once unmounted', async () => {
    const lookup = Promise.withResolvers()
    lookupReferencedFiles.mockReturnValue(lookup.promise)
    const service = makeService()

    const { unmount } = render(<Lookup service={service} />)
    await waitFor(() => expect(lookupReferencedFiles).toHaveBeenCalledTimes(1))
    unmount()
    await act(async () => lookup.resolve({ files: {} }))

    expect(service.terminate).not.toHaveBeenCalled()
  })
})
