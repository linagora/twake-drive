import { render, waitFor } from '@testing-library/react'
import React from 'react'

import { buildPickResult } from './buildPickResult'
import PickHandler from './index'
import {
  postCancelled,
  postDone,
  postError,
  postReady
} from '../../protocol/postResultToParent'

jest.mock('./buildPickResult', () => ({
  buildPickResult: jest.fn()
}))
jest.mock('../../protocol/postResultToParent', () => ({
  postReady: jest.fn(),
  postDone: jest.fn(),
  postError: jest.fn(),
  postCancelled: jest.fn()
}))

let filePickerProps
jest.mock('@/modules/services/components/FilePicker', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: props => {
      filePickerProps = props
      return React.createElement('div', { 'data-testid': 'file-picker-mock' })
    }
  }
})

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: () => ({ __isMockClient: true })
}))

beforeEach(() => {
  filePickerProps = undefined
  buildPickResult.mockReset()
  postReady.mockReset()
  postDone.mockReset()
  postError.mockReset()
  postCancelled.mockReset()
})

describe('PickHandler', () => {
  const params = {
    clientUrl: 'https://mail.alice.cozy',
    id: 'abc-123',
    type: ['sharingUrl'],
    allowedMimeType: 'image/*',
    multiple: false
  }

  it('sends READY on mount', () => {
    render(<PickHandler params={params} />)
    expect(postReady).toHaveBeenCalledWith({
      clientUrl: params.clientUrl,
      id: params.id
    })
  })

  it('forwards allowedMimeType and multiple to FilePicker', () => {
    render(<PickHandler params={params} />)
    expect(filePickerProps.accept).toBe('image/*')
    expect(filePickerProps.multiple).toBe(false)
  })

  it('posts done on single-select onChange', async () => {
    const results = [{ name: 'photo.jpg', mimeType: 'image/jpeg', size: 1 }]
    buildPickResult.mockResolvedValueOnce(results)

    render(<PickHandler params={params} />)
    await filePickerProps.onChange('file-1')

    await waitFor(() => {
      expect(buildPickResult).toHaveBeenCalledWith(
        expect.anything(),
        ['file-1'],
        ['sharingUrl']
      )
      expect(postDone).toHaveBeenCalledWith({
        clientUrl: params.clientUrl,
        id: params.id,
        results
      })
    })
  })

  it('posts done on multi-select onChange', async () => {
    const results = [
      { name: 'a.jpg', mimeType: 'image/jpeg', size: 1 },
      { name: 'b.jpg', mimeType: 'image/jpeg', size: 2 }
    ]
    buildPickResult.mockResolvedValueOnce(results)

    render(<PickHandler params={{ ...params, multiple: true }} />)
    await filePickerProps.onChange(['file-1', 'file-2'])

    await waitFor(() => {
      expect(buildPickResult).toHaveBeenCalledWith(
        expect.anything(),
        ['file-1', 'file-2'],
        ['sharingUrl']
      )
      expect(postDone).toHaveBeenCalled()
    })
  })

  it('posts resolution-failed error when buildPickResult throws', async () => {
    buildPickResult.mockRejectedValueOnce(new Error('boom'))

    render(<PickHandler params={params} />)
    await filePickerProps.onChange('file-1')

    await waitFor(() => {
      expect(postError).toHaveBeenCalledWith({
        clientUrl: params.clientUrl,
        id: params.id,
        message: 'resolution-failed'
      })
    })
  })

  it('posts cancelled on onClose', () => {
    render(<PickHandler params={params} />)
    filePickerProps.onClose()
    expect(postCancelled).toHaveBeenCalledWith({
      clientUrl: params.clientUrl,
      id: params.id
    })
  })

  it('does NOT post cancelled when onClose fires after a pick is in flight', async () => {
    // FilePicker.handleConfirm calls onChange() then onClose() synchronously,
    // back-to-back. handleChange is async, so without guarding, postCancelled
    // would race postDone — and in popup mode the early postCancelled closes
    // the window before the pick resolves, dropping the real result.
    const results = [{ name: 'photo.jpg', mimeType: 'image/jpeg', size: 1 }]
    buildPickResult.mockResolvedValueOnce(results)

    render(<PickHandler params={params} />)

    // Simulate FilePicker firing both callbacks in the same tick.
    filePickerProps.onChange('file-1')
    filePickerProps.onClose()

    await waitFor(() => {
      expect(postDone).toHaveBeenCalledWith({
        clientUrl: params.clientUrl,
        id: params.id,
        results
      })
    })
    expect(postCancelled).not.toHaveBeenCalled()
  })

  it('does NOT post cancelled when onClose fires after a failed pick', async () => {
    // Same guard should hold when the async pick rejects — we've already
    // reported an error, a trailing cancelled would just be noise.
    buildPickResult.mockRejectedValueOnce(new Error('boom'))

    render(<PickHandler params={params} />)
    filePickerProps.onChange('file-1')
    filePickerProps.onClose()

    await waitFor(() => {
      expect(postError).toHaveBeenCalledWith({
        clientUrl: params.clientUrl,
        id: params.id,
        message: 'resolution-failed'
      })
    })
    expect(postCancelled).not.toHaveBeenCalled()
  })
})
