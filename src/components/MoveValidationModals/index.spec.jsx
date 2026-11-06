import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import MoveValidationModals from '.'

import { useClipboardContext } from '@/contexts/ClipboardProvider'

jest.mock('@/contexts/ClipboardProvider', () => ({
  useClipboardContext: jest.fn()
}))

jest.mock('@/modules/move/MoveOutsideSharedFolderModal', () => ({
  MoveOutsideSharedFolderModal: ({ onConfirm, onCancel }) => (
    <>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </>
  )
}))

describe('MoveValidationModals', () => {
  const setup = () => {
    const calls = []
    const hideMoveValidationModal = jest.fn(() => calls.push('hide'))
    useClipboardContext.mockReturnValue({
      hideMoveValidationModal,
      moveValidationModal: {
        isVisible: true,
        type: 'moveOutside',
        files: [{ _id: 'file1' }],
        targetFolder: { _id: 'target' },
        onConfirm: jest.fn(async () => calls.push('confirm')),
        onCancel: jest.fn(() => calls.push('cancel'))
      }
    })
    render(<MoveValidationModals />)
    return calls
  }

  // The callback may open the next warning of the same paste, which a later hide would close.
  it('hides the modal before confirming', () => {
    const calls = setup()

    fireEvent.click(screen.getByText('Confirm'))

    expect(calls).toEqual(['hide', 'confirm'])
  })

  it('hides the modal before cancelling', () => {
    const calls = setup()

    fireEvent.click(screen.getByText('Cancel'))

    expect(calls).toEqual(['hide', 'cancel'])
  })
})
