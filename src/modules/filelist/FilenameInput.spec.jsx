'use strict'

import '@testing-library/jest-dom'
import { render, fireEvent, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import FilenameInput from './FilenameInput'
import AppLike from 'test/components/AppLike'

describe('FilenameInput', () => {
  const client = createMockClient({
    clientOptions: {
      uri: 'http://cozy.localhost:8080/'
    }
  })

  const setup = ({
    name = '',
    file = null,
    onSubmit = jest.fn(),
    onAbort = jest.fn(),
    onChange = jest.fn()
  } = {}) => {
    const root = render(
      <AppLike client={client}>
        <FilenameInput
          name={name}
          file={file}
          onSubmit={onSubmit}
          onAbort={onAbort}
          onChange={onChange}
        />
      </AppLike>
    )
    return { root, onSubmit, onAbort, onChange }
  }

  describe('handleKeyDown behavior', () => {
    it('should call submit when ENTER_KEY is pressed with non-empty value', () => {
      const { onSubmit } = setup()
      const input = screen.getByRole('textbox')

      // Type some text
      fireEvent.change(input, { target: { value: 'test-file' } })

      // Press Enter
      fireEvent.keyDown(input, { keyCode: 13 })

      expect(onSubmit).toHaveBeenCalledWith('test-file')
    })

    it('should call abort with accidental=true when ENTER_KEY is pressed with empty value', () => {
      const { onAbort } = setup()
      const input = screen.getByRole('textbox')

      // Press Enter with empty value
      fireEvent.keyDown(input, { keyCode: 13 })

      expect(onAbort).toHaveBeenCalledWith(true)
    })

    it('should call abort when ESC_KEY is pressed', () => {
      const { onAbort } = setup()
      const input = screen.getByRole('textbox')

      // Press Escape
      fireEvent.keyDown(input, { keyCode: 27 })

      expect(onAbort).toHaveBeenCalled()
    })
  })

  describe('handleBlur behavior', () => {
    it('should call submit when blurred with non-empty value', () => {
      const { onSubmit } = setup()
      const input = screen.getByRole('textbox')

      // Type some text
      fireEvent.change(input, { target: { value: 'test-file' } })

      // Blur the input
      fireEvent.blur(input)

      expect(onSubmit).toHaveBeenCalledWith('test-file')
    })

    it('should call abort when blurred with empty value', () => {
      const { onAbort } = setup()
      const input = screen.getByRole('textbox')

      // Blur with empty value
      fireEvent.blur(input)

      expect(onAbort).toHaveBeenCalled()
    })
  })

  describe('handleChange behavior', () => {
    it('should update state and call onChange when input changes', () => {
      const { onChange } = setup()
      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'new-value' } })

      expect(onChange).toHaveBeenCalledWith('new-value')
      expect(input.value).toBe('new-value')
    })
  })

  describe('race condition fix verification', () => {
    it('should not show unwanted notification for empty filename on ENTER_KEY', () => {
      const { onAbort } = setup()
      const input = screen.getByRole('textbox')

      // Simulate pressing Enter with empty value
      fireEvent.keyDown(input, { keyCode: 13 })

      // Should call abort with accidental=true, not show unwanted notification
      expect(onAbort).toHaveBeenCalledWith(true)
      expect(onAbort).toHaveBeenCalledTimes(1)
    })

    it('should handle blur correctly without race condition', () => {
      const { onSubmit, onAbort } = setup()
      const input = screen.getByRole('textbox')

      // Type some text and blur
      fireEvent.change(input, { target: { value: 'valid-file' } })
      fireEvent.blur(input)

      // Should submit without any race condition issues
      expect(onSubmit).toHaveBeenCalledWith('valid-file')
      expect(onAbort).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle whitespace-only value as non-empty', () => {
      const { onSubmit } = setup()
      const input = screen.getByRole('textbox')

      // Type whitespace and press Enter
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { keyCode: 13 })

      // Whitespace is considered non-empty by the component
      expect(onSubmit).toHaveBeenCalledWith('   ')
    })
    it('should not submit twice when Enter is followed by blur', () => {
      const { onSubmit, onAbort } = setup()
      const input = screen.getByRole('textbox')

      // Type a value
      fireEvent.change(input, { target: { value: 'test-file' } })

      // Press Enter, then blur immediately
      fireEvent.keyDown(input, { keyCode: 13 })
      fireEvent.blur(input)

      // Should only submit once, not twice
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith('test-file')
      expect(onAbort).not.toHaveBeenCalled()
    })
  })
})
