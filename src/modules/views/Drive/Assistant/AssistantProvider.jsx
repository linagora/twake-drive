import React, { createContext, useContext, useMemo, useState } from 'react'

import { useClient } from 'cozy-client'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'
import {
  CREATE_FOLDER,
  normalizeFolderName
} from '@/modules/views/Drive/Assistant/capabilities'

const HTTP_CODE_CONFLICT = 409

const AssistantContext = createContext({ isAvailable: false, isOpen: false })

export const useAssistant = () => useContext(AssistantContext)

const isConflictError = error =>
  error?.status === HTTP_CODE_CONFLICT ||
  error?.response?.status === HTTP_CODE_CONFLICT

export const AssistantProvider = ({ children }) => {
  const client = useClient()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const { addItems } = useNewItemHighlightContext()
  const { displayedFolder } = useDisplayedFolder()
  const [isOpen, setIsOpen] = useState(false)

  // Nothing is created in the trash: the root takes its place there, and
  // while the displayed folder is still loading
  const displayedFolderId = displayedFolder?.id ?? null
  const dirId =
    displayedFolderId === null || displayedFolderId === TRASH_DIR_ID
      ? ROOT_DIR_ID
      : displayedFolderId

  const value = useMemo(() => {
    const createFolder = async params => {
      const name = normalizeFolderName(params)
      if (name === null) {
        logger.warn('Assistant: folder call ignored, no valid name', params)
        return
      }
      try {
        const { data } = await client
          .collection(DOCTYPE_FILES)
          .create({ name, dirId, type: 'directory' })
        addItems([data])
        showAlert({
          message: t('Assistant.folderCreated'),
          severity: 'success'
        })
      } catch (error) {
        logger.warn('Assistant: folder creation failed', error)
        showAlert({
          message: isConflictError(error)
            ? t('alert.folder_name', { folderName: name })
            : t('Assistant.folderError'),
          severity: 'error'
        })
      }
    }

    return {
      isAvailable: true,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      applyResult: async result => {
        const { capability, params } = result ?? {}
        if (capability === CREATE_FOLDER) {
          await createFolder(params)
        } else {
          logger.warn(
            `Assistant: capability call ignored: ${capability}`,
            params
          )
        }
      }
    }
  }, [client, dirId, isOpen, addItems, showAlert, t])

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}
