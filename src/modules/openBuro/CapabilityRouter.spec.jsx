import { render, screen } from '@testing-library/react'
import React from 'react'

import CapabilityRouter from './CapabilityRouter'
import { postError } from './protocol/postResultToParent'

jest.mock('./protocol/postResultToParent', () => ({
  postError: jest.fn()
}))

jest.mock('./handlers', () => {
  const React = require('react')
  return {
    capabilityHandlers: {
      PICK: ({ params }) =>
        React.createElement('div', {
          'data-testid': 'pick-mock',
          'data-client-url': params.clientUrl
        })
    }
  }
})

beforeEach(() => {
  postError.mockReset()
})

describe('CapabilityRouter', () => {
  const params = {
    clientUrl: 'https://mail.alice.cozy',
    id: 'abc-123',
    type: ['sharingUrl'],
    allowedMimeType: '',
    multiple: false
  }

  it('renders the matching handler for a known action', () => {
    render(<CapabilityRouter action="PICK" params={params} />)
    const mock = screen.getByTestId('pick-mock')
    expect(mock.dataset.clientUrl).toBe(params.clientUrl)
  })

  it('posts unknown-action error and renders nothing for an unknown action', () => {
    const { container } = render(
      <CapabilityRouter action="SAVE" params={params} />
    )
    expect(postError).toHaveBeenCalledWith({
      clientUrl: params.clientUrl,
      id: params.id,
      message: 'unknown-action'
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a static error and does NOT postMessage when params are missing', () => {
    render(
      <CapabilityRouter action="PICK" params={{ error: 'missing-params' }} />
    )
    expect(postError).not.toHaveBeenCalled()
    expect(
      screen.getByText(/missing required OpenBuro params/i)
    ).toBeInTheDocument()
  })
})
