import React, { createContext, useContext, useMemo, useState } from 'react'

import { models, useClient, useQuery } from 'cozy-client'
import flag from 'cozy-flags'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'
import {
  DOCX_MIME_TYPE,
  markdownToDocx
} from '@/modules/views/Drive/Assistant/markdownToDocx'
import {
  CREATE_DOCUMENT,
  CREATE_FOLDER,
  makeFileName,
  normalizeFolderName,
  splitTitle
} from '@/modules/views/Drive/Assistant/tools'
import { buildAssistantsQuery } from '@/queries'

const HTTP_CODE_CONFLICT = 409

const AssistantContext = createContext({ isAvailable: false, isOpen: false })

export const useAssistant = () => useContext(AssistantContext)

const isKnowledgeBaseOf = (assistant, folderId) =>
  (assistant.relationships?.knowledgeBase?.data ?? []).some(
    ref => ref._type === DOCTYPE_FILES && ref._id === folderId
  )

const isConflictError = error =>
  error?.status === HTTP_CODE_CONFLICT ||
  error?.response?.status === HTTP_CODE_CONFLICT

export const AssistantProvider = ({ folderId, children }) => {
  const client = useClient()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const { addItems } = useNewItemHighlightContext()
  const { displayedFolder } = useDisplayedFolder()
  const [isOpen, setIsOpen] = useState(false)
  const assistantsQuery = buildAssistantsQuery()
  const { data: assistants } = useQuery(
    assistantsQuery.definition,
    assistantsQuery.options
  )
  // Offered only in the folders an assistant answers from
  const isKnowledgeBaseFolder = (assistants ?? []).some(assistant =>
    isKnowledgeBaseOf(assistant, folderId)
  )

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
      // The assistant writes the content with a "# " title line and sends
      // the title as params.title (Tool.content, docs/assistant-intent.md of
      // twake-assistant); params.title is the fallback when the LLM leaves
      // the line out
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
      isKnowledgeBaseFolder,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      applyResult: async result => {
        const { tool, params, text } = result ?? {}
        if (tool === CREATE_FOLDER) {
          await createFolder(params)
        } else if (tool === CREATE_DOCUMENT) {
          await createDocument(params, text)
        } else {
          logger.warn(`Assistant: tool call ignored: ${tool}`, params)
        }
      }
    }
  }, [client, dirId, isKnowledgeBaseFolder, isOpen, addItems, showAlert, t])

  // Without the flag, the views keep their layout of before the assistant
  if (!flag('cozy.assistant.enabled')) return children

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}
