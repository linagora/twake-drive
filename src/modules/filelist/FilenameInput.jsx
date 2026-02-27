import cx from 'classnames'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { translate } from 'twake-i18n'

import { isDirectory } from 'cozy-client/dist/models/file'
import Button from 'cozy-ui/transpiled/react/Buttons'
import { Dialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Spinner from 'cozy-ui/transpiled/react/Spinner'

import styles from '@/styles/filenameinput.styl'

import { CozyFile } from '@/models'

const ENTER_KEY = 13
const ESC_KEY = 27

const valueIsEmpty = value => value.toString() === ''

const FilenameInput = ({
  name: initialName = '',
  file,
  onSubmit,
  onAbort,
  onChange,
  t,
  className,
  style
}) => {
  const textInput = useRef()
  const [value, setValue] = useState(initialName || '')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState(false)
  const [isModalOpened, setIsModalOpened] = useState(false)

  // Use a ref for synchronous guard to prevent race conditions
  // when Enter and blur fire in quick succession
  const isSubmittingRef = useRef(false)
  const isSavingRef = useRef(false)

  const save = useCallback(async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    if (!onSubmit) {
      setWorking(false)
      isSubmittingRef.current = false
      isSavingRef.current = false
      return
    }

    try {
      await onSubmit(value)
    } catch (e) {
      setError(true)
    } finally {
      setWorking(false)
      isSubmittingRef.current = false
      isSavingRef.current = false
    }
  }, [onSubmit, value])

  const abort = useCallback(
    (accidental = false) => {
      if (isModalOpened) {
        setIsModalOpened(false)
      }
      onAbort && onAbort(accidental)
      isSubmittingRef.current = false
      setWorking(false)
    },
    [isModalOpened, onAbort]
  )

  const handleKeyDown = e => {
    if (e.keyCode === ENTER_KEY) {
      if (valueIsEmpty(value)) {
        abort(true)
      } else {
        submit()
      }
    } else if (e.keyCode === ESC_KEY) {
      abort()
    }
  }

  const handleChange = e => {
    const newValue = e.target.value
    setValue(newValue)
    onChange && onChange(newValue)
  }

  const handleBlur = () => {
    if (valueIsEmpty(value)) {
      abort(!!initialName)
    } else {
      submit()
    }
  }

  const submit = () => {
    // Use ref for synchronous guard - state updates are async
    // so they don't prevent double submission in same event loop
    if (isSubmittingRef.current) return

    isSubmittingRef.current = true
    setWorking(true)
    setError(false)

    if (!initialName) {
      save()
      return
    }

    if (file && !isDirectory(file)) {
      const previousExtension = CozyFile.splitFilename({
        name: initialName,
        type: 'file'
      }).extension
      const newExtension = CozyFile.splitFilename({
        name: value,
        type: 'file'
      }).extension
      if (previousExtension !== newExtension) {
        setIsModalOpened(true)
      } else {
        save()
      }
    } else {
      save()
    }
  }

  const shouldSetSelection = useRef(false)

  const handleFocus = () => {
    if (!initialName) return
    shouldSetSelection.current = true
  }

  useEffect(() => {
    if (!shouldSetSelection.current || !textInput.current) return
    if (!initialName) return

    const { filename } = CozyFile.splitFilename({
      name: initialName,
      type: 'file'
    })

    textInput.current.setSelectionRange(
      0,
      isDirectory(file) ? initialName.length : filename.length
    )
    shouldSetSelection.current = false
  }, [initialName, file])

  return (
    <div
      data-testid="name-input"
      className={cx(styles['fil-file-name-input'], className)}
      style={style}
    >
      <input
        type="text"
        value={value}
        ref={textInput}
        disabled={working}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={error ? styles['error'] : null}
        autoFocus
      />
      {working && <Spinner />}
      <Dialog
        onClose={abort}
        open={isModalOpened}
        title={t('RenameModal.title')}
        content={t('RenameModal.description')}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={abort}
              label={t('RenameModal.cancel')}
            />
            <Button
              variant="primary"
              label={t('RenameModal.continue')}
              onClick={save}
            />
          </>
        }
        actionsLayout="row"
      />
    </div>
  )
}

export default translate()(FilenameInput)
