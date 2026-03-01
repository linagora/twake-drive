import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'

import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import PaperplaneIcon from 'cozy-ui/transpiled/react/Icons/Paperplane'
import InputBase from 'cozy-ui/transpiled/react/InputBase'

/**
 * ScribePromptInput - Free prompt input with send button.
 *
 * Renders a text input with "Help me write" placeholder and a send button.
 * Submits on Enter key or send button click. Clears input after submit.
 *
 * @param {Object} props
 * @param {Function} props.onSubmit - Called with the trimmed prompt text
 */
const ScribePromptInput = ({ onSubmit }) => {
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
      setValue('')
    }
  }, [value, onSubmit])

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Enter') {
        e.stopPropagation()
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px 4px 16px'
      }}
    >
      <InputBase
        placeholder="Help me write"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ flexGrow: 1 }}
        fullWidth
      />
      <IconButton size="small" onClick={handleSubmit}>
        <Icon icon={PaperplaneIcon} size={16} />
      </IconButton>
    </div>
  )
}

ScribePromptInput.propTypes = {
  onSubmit: PropTypes.func.isRequired
}

export { ScribePromptInput }
