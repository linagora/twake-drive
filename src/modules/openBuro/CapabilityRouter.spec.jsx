import { render, screen } from '@testing-library/react'
import React from 'react'

import CapabilityRouter from './CapabilityRouter'
import { postError } from './protocol/postResultToParent'

jest.mock('./protocol/postResultToParent', () => ({
  postError: jest.fn()
}))

// Register handlers for BOTH PICK (declared in manifest) and SAVE (NOT
// declared) so the drift-guard test below can prove that the router uses
// the manifest — not the handler registry — as the source of truth.
jest.mock('./handlers', () => {
  const React = require('react')
  return {
    capabilityHandlers: {
      PICK: ({ params }) =>
        React.createElement('div', {
          'data-testid': 'pick-mock',
          'data-client-url': params.clientUrl
        }),
      SAVE: () => React.createElement('div', { 'data-testid': 'save-mock' })
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

  it('renders the matching handler for an action declared in the manifest', () => {
    render(<CapabilityRouter action="PICK" params={params} />)
    const mock = screen.getByTestId('pick-mock')
    expect(mock.dataset.clientUrl).toBe(params.clientUrl)
  })

  it('posts unknown-action and renders nothing when the action is not declared in the manifest', () => {
    // SAVE has a handler mocked above but is NOT in the capability
    // manifest — the router must still refuse it.
    const { container } = render(
      <CapabilityRouter action="SAVE" params={params} />
    )
    expect(postError).toHaveBeenCalledWith({
      clientUrl: params.clientUrl,
      id: params.id,
      message: 'unknown-action'
    })
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('save-mock')).toBeNull()
  })

  it('posts unknown-action for a completely unknown action', () => {
    const { container } = render(
      <CapabilityRouter action="NUKE" params={params} />
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
