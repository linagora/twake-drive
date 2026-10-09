import React, { createContext, useContext, useMemo, useState } from 'react'

import { models, useClient } from 'cozy-client'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'
import {
  CREATE_DOCUMENT,
  CREATE_FOLDER,
  makeFileName,
  normalizeFolderName,
  splitTitle
} from '@/modules/views/Drive/Assistant/capabilities'
import {
  DOCX_MIME_TYPE,
  markdownToDocx
} from '@/modules/views/Drive/Assistant/markdownToDocx'

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

    const createDocument = async (params, text) => {
      if (typeof text !== 'string') {
        logger.warn('Assistant: document call ignored, no text', params)
        return
      }
      // cozy-stack asks the LLM to start the content with a "# " title line
      // (writingPrompt, model/rag/router.go); params.title is the fallback
      // when it leaves it out
      const { title: heading, body } = splitTitle(text)
      const title = heading ?? params?.title
      if (typeof title !== 'string' || title.trim() === '') {
        logger.warn('Assistant: document call ignored, no title', params)
        return
      }
      try {
        const docx = markdownToDocx(title, body)
        const { data } = await models.file.uploadFileWithConflictStrategy(
          client,
          docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength),
          {
            name: makeFileName(title, 'docx'),
            dirId,
            conflictStrategy: 'rename',
            contentType: DOCX_MIME_TYPE
          }
        )
        addItems([data])
        showAlert({
          message: t('Assistant.documentCreated'),
          severity: 'success'
        })
      } catch (error) {
        logger.warn('Assistant: document creation failed', error)
        showAlert({ message: t('Assistant.documentError'), severity: 'error' })
      }
    }

    return {
      isAvailable: true,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      applyResult: async result => {
        const { capability, params, text } = result ?? {}
        if (capability === CREATE_FOLDER) {
          await createFolder(params)
        } else if (capability === CREATE_DOCUMENT) {
          await createDocument(params, text)
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
