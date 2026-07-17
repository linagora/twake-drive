import { render, waitFor } from '@testing-library/react'
import React from 'react'

import { buildContentFolderQuery } from './FilePicker/queries'
import IntentHandler from './IntentHandler'

const mockClient = { query: jest.fn() }
const mockCreateService = jest.fn()
const mockRootFolderDefinition = { doctype: 'io.cozy.files' }
const mockRootFolderOptions = {
  as: 'buildContentFolderQuery-io.cozy.files.root-dir',
  fetchPolicy: jest.fn()
}

jest.mock('cozy-client', () => ({
  useClient: () => mockClient
}))

jest.mock('cozy-interapp', () =>
  jest.fn().mockImplementation(() => ({ createService: mockCreateService }))
)

jest.mock('./FilePicker/queries', () => ({
  buildContentFolderQuery: jest.fn()
}))

jest.mock('cozy-logger', () => ({
  error: jest.fn(),
  warn: jest.fn()
}))

jest.mock('./Picker', () => () => <div data-testid="picker" />)

function makeDeferredPromise() {
  let resolvePromise
  const promise = new Promise(resolve => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}

describe('IntentHandler', () => {
  beforeEach(() => {
    buildContentFolderQuery.mockReturnValue({
      definition: () => mockRootFolderDefinition,
      options: mockRootFolderOptions
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('prefetches the root folder while the intent handshake is pending', async () => {
    const handshake = makeDeferredPromise()
    const rootFolderPrefetch = makeDeferredPromise()
    mockCreateService.mockReturnValue(handshake.promise)
    mockClient.query.mockReturnValue(rootFolderPrefetch.promise)

    const { getByTestId, queryByTestId } = render(
      <IntentHandler intentId="intent-id" />
    )

    expect(buildContentFolderQuery).toHaveBeenCalledWith(
      'io.cozy.files.root-dir'
    )
    expect(mockClient.query).toHaveBeenCalledWith(
      mockRootFolderDefinition,
      mockRootFolderOptions
    )
    expect(mockCreateService).toHaveBeenCalledWith('intent-id', window)

    const service = {
      getIntent: () => ({
        attributes: { action: 'PICK', type: 'io.cozy.files' }
      })
    }
    handshake.resolve(service)

    await waitFor(() => expect(mockCreateService).toHaveBeenCalledTimes(1))
    expect(queryByTestId('picker')).not.toBeInTheDocument()

    rootFolderPrefetch.resolve({ data: [] })

    await waitFor(() => expect(getByTestId('picker')).toBeInTheDocument())
    expect(mockClient.query).toHaveBeenCalledTimes(1)
  })

  it('shows the picker when the root folder prefetch fails', async () => {
    mockClient.query.mockRejectedValue(new Error('prefetch failed'))
    mockCreateService.mockResolvedValue({
      getIntent: () => ({
        attributes: { action: 'PICK', type: 'io.cozy.files' }
      })
    })

    const { getByTestId } = render(<IntentHandler intentId="intent-id" />)

    await waitFor(() => expect(getByTestId('picker')).toBeInTheDocument())
  })
})
