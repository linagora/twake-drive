import { render, screen } from '@testing-library/react'
import React from 'react'

import { MoveDestinationActions } from './MoveDestinationActions'

jest.mock('twake-i18n', () => ({
  useI18n: () => ({ t: key => key })
}))

const props = {
  canCreateFolder: false,
  isNavigationLocked: false,
  isFolderCreationDisplayed: false,
  onCreate: jest.fn(),
  onClose: jest.fn(),
  isBrowserBusy: false,
  onRetryResult: null,
  onConfirm: jest.fn(),
  hasConfirmHandler: true,
  canConfirm: true,
  isBusy: false,
  isValidatingDestination: false
}

describe('MoveDestinationActions', () => {
  it('confirms with the label the caller asks for', () => {
    render(<MoveDestinationActions {...props} confirmLabel="Save to" />)

    expect(screen.getByRole('button', { name: 'Save to' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Move.action' })).toBe(null)
  })

  it('confirms with Move without a label of the caller', () => {
    render(<MoveDestinationActions {...props} />)

    expect(
      screen.getByRole('button', { name: 'Move.action' })
    ).toBeInTheDocument()
  })

  it('offers to retry rather than the label of the caller after a failure', () => {
    render(
      <MoveDestinationActions
        {...props}
        confirmLabel="Save to"
        onRetryResult={jest.fn()}
      />
    )

    expect(
      screen.getByRole('button', { name: 'Viewer.loading.retry' })
    ).toBeInTheDocument()
  })
})
