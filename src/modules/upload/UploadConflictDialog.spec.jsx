import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import UploadConflictDialog from './UploadConflictDialog'
import { uploadConflictStrategies } from './constants'
import { TestI18n } from 'test/components/AppLike'

const renderDialog = props =>
  render(
    <CozyTheme>
      <BreakpointsProvider>
        <TestI18n>
          <UploadConflictDialog
            onCancel={jest.fn()}
            onClose={jest.fn()}
            onConfirm={jest.fn()}
            {...props}
          />
        </TestI18n>
      </BreakpointsProvider>
    </CozyTheme>
  )

describe('UploadConflictDialog', () => {
  it('selects replace by default and confirms it', () => {
    const onClose = jest.fn()
    const onConfirm = jest.fn()
    renderDialog({ onClose, onConfirm })

    expect(
      screen.getByRole('radio', { name: 'Replace existing file' })
    ).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    expect(onConfirm).toHaveBeenCalledWith(uploadConflictStrategies.REPLACE)
    expect(onClose).toHaveBeenCalled()
  })

  it('confirms keep-both when the user selects it', () => {
    const onConfirm = jest.fn()
    renderDialog({ onConfirm })

    fireEvent.click(screen.getByRole('radio', { name: 'Keep both files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    expect(onConfirm).toHaveBeenCalledWith(uploadConflictStrategies.KEEP_BOTH)
  })

  it('cancels and closes the modal', () => {
    const onCancel = jest.fn()
    const onClose = jest.fn()
    const onConfirm = jest.fn()
    renderDialog({ onCancel, onClose, onConfirm })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
