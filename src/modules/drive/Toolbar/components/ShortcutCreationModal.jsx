import React, { useCallback, useEffect, useState } from 'react'

import { useClient } from 'cozy-client'
import { isIOS } from 'cozy-device-helper'
import Button from 'cozy-ui/transpiled/react/Buttons'
import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import InputAdornment from 'cozy-ui/transpiled/react/InputAdornment'
import Stack from 'cozy-ui/transpiled/react/Stack'
import TextField from 'cozy-ui/transpiled/react/TextField'
import useBrowserOffline from 'cozy-ui/transpiled/react/hooks/useBrowserOffline'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { useDisplayedFolder } from '@/hooks'
import { displayedFolderOrRootFolder } from '@/hooks/helpers'
import { DOCTYPE_FILES_SHORTCUT } from '@/lib/doctypes'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

const ENTER_KEY = 13

const isURLValid = url => {
  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

const makeURLValid = str => {
  if (isURLValid(str)) return str
  else if (isURLValid(`https://${str}`)) return `https://${str}`
  return false
}
const ShortcutCreationModal = ({ onClose, onCreated }) => {
  const { displayedFolder } = useDisplayedFolder()
  const { t } = useI18n()
  const [fileName, setFilename] = useState('')
  const [url, setUrl] = useState('')
  const client = useClient()
  const { showAlert } = useAlert()
  const isOffline = useBrowserOffline()
  const { addItems } = useNewItemHighlightContext()

  const _displayedFolder = displayedFolderOrRootFolder(displayedFolder)

  const createShortcut = useCallback(async () => {
    if (!fileName || !url) {
      showAlert({ message: t('Shortcut.needs_info'), severity: 'error' })
      return
    }
    const makedURL = makeURLValid(url)
    if (!makedURL) {
      showAlert({ message: t('Shortcut.url_badformat'), severity: 'error' })
      return
    }
    try {
      if (isOffline) {
        showAlert({ message: t('alert.offline'), severity: 'error' })
      } else {
        const response = await client.save({
          _type: DOCTYPE_FILES_SHORTCUT,
          dir_id: _displayedFolder.id,
          name: fileName.endsWith('.url') ? fileName : fileName + '.url',
          url: makedURL
        })
        const createdShortcut = response?.data ?? response
        if (createdShortcut) {
          addItems([createdShortcut])
        }
        showAlert({ message: t('Shortcut.created'), severity: 'success' })
        if (onCreated) onCreated()
      }
      onClose()
    } catch (error) {
      if (
        error.message.includes(
          'NetworkError when attempting to fetch resource.'
        )
      ) {
        showAlert({ message: t('upload.alert.network'), severity: 'error' })
      } else if (
        error.message.includes(
          'Invalid filename containing illegal character(s):'
        )
      ) {
        showAlert({
          message: t('alert.file_name_illegal_characters', {
            fileName,
            characters: error.message.split(
              'Invalid filename containing illegal character(s): '
            )[1]
          }),
          severity: 'error',
          duration: 2000
        })
      } else if (error.message.includes('Invalid filename:')) {
        showAlert({
          message: t('alert.file_name_illegal_name', { fileName }),
          severity: 'error'
        })
      } else if (error.message.includes('Missing name argument')) {
        showAlert({ message: t('alert.file_name_missing'), severity: 'error' })
      } else {
        showAlert({ message: t('Shortcut.errored'), severity: 'error' })
      }
    }
  }, [
    client,
    fileName,
    onClose,
    onCreated,
    t,
    url,
    _displayedFolder,
    isOffline,
    showAlert,
    addItems
  ])

  const handleKeyDown = e => {
    if (e.keyCode === ENTER_KEY) {
      createShortcut()
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isIOS()) window.scrollTo(0, 0)
    }, 30)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <FixedDialog
      onClose={onClose}
      title={t('Shortcut.title_modal')}
      open={true}
      content={
        <Stack>
          <div>
            <TextField
              label={t('Shortcut.url')}
              id="shortcuturl"
              variant="outlined"
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => handleKeyDown(e)}
              fullWidth
              margin="normal"
              autoFocus
            />
          </div>
          <div>
            <TextField
              label={t('Shortcut.filename')}
              id="shortcutfilename"
              variant="outlined"
              onChange={e => setFilename(e.target.value)}
              fullWidth
              margin="normal"
              onKeyDown={e => handleKeyDown(e)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">.url</InputAdornment>
                )
              }}
            />
          </div>
        </Stack>
      }
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            label={t('Shortcut.cancel')}
          />
          <Button
            variant="primary"
            label={t('Shortcut.create')}
            onClick={createShortcut}
          />
        </>
      }
    />
  )
}

export default ShortcutCreationModal
