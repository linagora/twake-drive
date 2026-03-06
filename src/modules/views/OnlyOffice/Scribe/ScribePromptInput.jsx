import React, { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import PropTypes from 'prop-types'

import { useI18n } from 'twake-i18n'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import PaperplaneIcon from 'cozy-ui/transpiled/react/Icons/Paperplane'
import InputBase from 'cozy-ui/transpiled/react/InputBase'

const ScribePromptInput = forwardRef(({ onSubmit, onArrow, onEscape }, ref) => {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (inputRef.current) inputRef.current.focus()
    }
  }))

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
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        if (onArrow) onArrow('up')
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        if (onArrow) onArrow('down')
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (onEscape) onEscape()
      }
    },
    [handleSubmit, onArrow, onEscape]
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px 0 16px',
        height: 48
      }}
    >
      <InputBase
        inputRef={inputRef}
        placeholder={t('Scribe.prompt.placeholder')}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ flexGrow: 1 }}
        fullWidth
      />
      <IconButton
        size="small"
        onClick={handleSubmit}
        style={{
          backgroundColor: '#D6DEFF',
          color: '#5B6FC0',
          width: 32,
          height: 32
        }}
      >
        <Icon icon={PaperplaneIcon} size={16} />
      </IconButton>
    </div>
  )
})

ScribePromptInput.displayName = 'ScribePromptInput'

ScribePromptInput.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onArrow: PropTypes.func,
  onEscape: PropTypes.func
}

ScribePromptInput.defaultProps = {
  onArrow: null,
  onEscape: null
}

export { ScribePromptInput }
