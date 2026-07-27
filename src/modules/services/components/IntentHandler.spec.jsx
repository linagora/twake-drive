import { act, render, waitFor } from '@testing-library/react'
import React from 'react'

import logger from 'cozy-logger'

import { buildContentFolderQuery } from './FilePicker/queries'
import IntentHandler from './IntentHandler'

const mockClient = { query: jest.fn() }
const mockCreateService = jest.fn()
const mockGetIntent = jest.fn()
const mockRootFolderDefinition = { doctype: 'io.cozy.files' }
const mockRootFolderOptions = {
  as: 'buildContentFolderQuery-io.cozy.files.root-dir',
  fetchPolicy: jest.fn()
}

jest.mock('cozy-client', () => ({
  useClient: () => mockClient
}))

jest.mock('cozy-interapp', () =>
  jest.fn().mockImplementation(() => ({
    createService: mockCreateService,
    request: { get: mockGetIntent }
  }))
)

jest.mock('./FilePicker/queries', () => ({
  buildContentFolderQuery: jest.fn()
}))

jest.mock('cozy-logger', () => ({
  error: jest.fn(),
  warn: jest.fn()
}))

jest.mock(
  'cozy-ui-plus/dist/providers/CozyTheme',
  () =>
    ({ children, ignoreItself, type }) => (
      <div
        data-testid="intent-theme"
        data-theme={type}
        data-ignore-itself={ignoreItself}
      >
        {children}
      </div>
    )
)

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
    mockGetIntent.mockResolvedValue({
      attributes: { action: 'PICK', type: 'io.cozy.files' }
    })
    buildContentFolderQuery.mockReturnValue({
      definition: () => mockRootFolderDefinition,
      options: mockRootFolderOptions
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it.each(['light', 'dark'])(
    'forces the %s theme while the picker initializes',
    async theme => {
      mockGetIntent.mockResolvedValue({
        attributes: {
          action: 'PICK',
          type: 'io.cozy.files',
          data: { theme: { type: theme } }
        }
      })
      mockCreateService.mockReturnValue(new Promise(() => {}))
      mockClient.query.mockReturnValue(new Promise(() => {}))

      const { getByTestId, queryByTestId } = render(
        <IntentHandler intentId="intent-id" />
      )

      await waitFor(() =>
        expect(getByTestId('intent-theme')).toHaveAttribute('data-theme', theme)
      )
      expect(getByTestId('intent-theme')).toHaveAttribute(
        'data-ignore-itself',
        'false'
      )
      expect(queryByTestId('picker')).toBe(null)
    }
  )

  it('prefetches the root folder while the intent handshake is pending', async () => {
    const handshake = makeDeferredPromise()
    const rootFolderPrefetch = makeDeferredPromise()
    mockCreateService.mockReturnValue(handshake.promise)
    mockClient.query.mockReturnValue(rootFolderPrefetch.promise)

    const { getByTestId, queryByTestId } = render(
      <IntentHandler intentId="intent-id" />
    )

    expect(mockCreateService).toHaveBeenCalledWith('intent-id', window)
    await waitFor(() =>
      expect(buildContentFolderQuery).toHaveBeenCalledWith(
        'io.cozy.files.root-dir'
      )
    )
    expect(mockClient.query).toHaveBeenCalledWith(
      mockRootFolderDefinition,
      mockRootFolderOptions
    )

    const service = {
      getIntent: () => ({
        attributes: { action: 'PICK', type: 'io.cozy.files' }
      })
    }
    await act(async () => {
      handshake.resolve(service)
    })

    expect(queryByTestId('picker')).toBe(null)

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

  it('does not prefetch the root folder for unrelated intents', async () => {
    const intent = {
      attributes: { action: 'OPEN', type: 'io.cozy.files' }
    }
    const getIntent = jest.fn(() => intent)
    mockGetIntent.mockResolvedValue(intent)
    mockCreateService.mockResolvedValue({ getIntent })

    render(<IntentHandler intentId="intent-id" />)

    await waitFor(() => expect(getIntent).toHaveBeenCalled())
    expect(buildContentFolderQuery).not.toHaveBeenCalled()
    expect(mockClient.query).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })
})
