import React, { createContext, useContext, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'

import { models, useClient, useQuery } from 'cozy-client'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { createFolder as createFolderAction } from '@/modules/navigation/duck'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'
import {
  CREATE_DOCUMENT,
  CREATE_FOLDER,
  makeFileName,
  normalizeFolderName,
  splitTitle
} from '@/modules/views/Drive/Assistant/tools'
import { buildAssistantsQuery } from '@/queries'

const AssistantContext = createContext({ isAvailable: false, isOpen: false })

export const useAssistant = () => useContext(AssistantContext)

const isKnowledgeBaseOf = (assistant, folderId) =>
  (assistant.relationships?.knowledgeBase?.data ?? []).some(
    ref => ref._type === DOCTYPE_FILES && ref._id === folderId
  )

export const AssistantProvider = ({ folderId, children }) => {
  const client = useClient()
  const dispatch = useDispatch()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const { addItems } = useNewItemHighlightContext()
  const { hasWriteAccess } = useSharingContext()
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
  const canWrite = hasWriteAccess(folderId)

  const value = useMemo(() => {
    // The user has confirmed the call: when Drive cannot run it, they are told
    const refuse = (message, reason, params) => {
      logger.warn(`Assistant: ${reason}`, params)
      showAlert({ message, severity: 'error' })
    }

    const createFolder = async params => {
      const name = normalizeFolderName(params)
      if (name === null) {
        refuse(t('Assistant.folderError'), 'folder call without a name', params)
        return
      }
      try {
        await dispatch(
          createFolderAction(
            client,
            name,
            folderId,
            { showAlert, t },
            null,
            addItems
          )
        )
        showAlert({
          message: t('Assistant.folderCreated'),
          severity: 'success'
        })
      } catch (error) {
        // createFolder has told the user already
        logger.warn('Assistant: folder creation failed', error)
      }
    }

    const createDocument = async (params, text) => {
      if (typeof text !== 'string') {
        refuse(
          t('Assistant.documentError'),
          'document call without text',
          params
        )
        return
      }
      // The assistant writes the content with a "# " title line and sends
      // the title as params.title (Tool.content, docs/assistant-intent.md of
      // twake-assistant); params.title is the fallback when the LLM leaves
      // the line out, or leaves it empty
      const { title: heading, body } = splitTitle(text)
      const title = heading || params?.title
      if (typeof title !== 'string' || title.trim() === '') {
        refuse(
          t('Assistant.documentError'),
          'document call without a title',
          params
        )
        return
      }
      try {
        // Loaded on demand, with the Markdown parser: only a document needs it
        const { DOCX_MIME_TYPE, markdownToDocx } =
          await import('@/modules/views/Drive/Assistant/markdownToDocx')
        const docx = markdownToDocx(title, body)
        const { data } = await models.file.uploadFileWithConflictStrategy(
          client,
          docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength),
          {
            name: makeFileName(title, 'docx'),
            dirId: folderId,
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
      canWrite,
      isKnowledgeBaseFolder,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      applyResult: async result => {
        const { tool, params, text } = result ?? {}
        // No tool is offered in a read-only folder, but a card proposed in
        // another folder can still be confirmed after a navigation
        if (!canWrite) {
          refuse(t('Assistant.readOnly'), `${tool} call in a read-only folder`)
          return
        }
        if (tool === CREATE_FOLDER) {
          await createFolder(params)
        } else if (tool === CREATE_DOCUMENT) {
          await createDocument(params, text)
        } else {
          refuse(t('Assistant.toolError'), `unknown tool call: ${tool}`, params)
        }
      }
    }
  }, [
    client,
    dispatch,
    folderId,
    canWrite,
    isKnowledgeBaseFolder,
    isOpen,
    addItems,
    showAlert,
    t
  ])

  // Without the flag, the views keep their layout of before the assistant
  if (!flag('cozy.assistant.enabled')) return children

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}
