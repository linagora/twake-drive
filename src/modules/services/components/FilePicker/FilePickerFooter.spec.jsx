import { render, fireEvent } from '@testing-library/react'
import React from 'react'

import FilePickerFooter from './FilePickerFooter'
import DemoProvider from './docs/DemoProvider'

describe('FilePickerFooter components:', () => {
  const mockOnConfirm = jest.fn()
  const mockOnClose = jest.fn()

  const setup = (disabledConfirm = false) => {
    return render(
      <DemoProvider>
        <FilePickerFooter
          onConfirm={mockOnConfirm}
          onClose={mockOnClose}
          disabledConfirm={disabledConfirm}
        />
      </DemoProvider>
    )
  }
  it('should be rendered correctly', () => {
    const { container } = setup()

    expect(container).toBeDefined()
  })

  it('should confirm button have been called', () => {
    const { getByTestId } = setup()
    fireEvent.click(getByTestId('confirm-btn'))

    expect(mockOnConfirm).toHaveBeenCalled()
  })

  it('should close button have been called', () => {
    const { getByTestId } = setup()
    fireEvent.click(getByTestId('close-btn'))

    expect(mockOnClose).toHaveBeenCalled()
  })
})
