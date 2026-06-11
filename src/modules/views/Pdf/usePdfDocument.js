import { useCallback, useEffect, useRef, useState } from 'react'

import { useClient } from 'cozy-client'

import logger from '@/lib/logger'
import { usePdfSave } from '@/modules/views/Pdf/usePdfSave'

const readPdfBlobUrl = async (client, fileId, driveId) => {
  const response = await client
    .collection('io.cozy.files', driveId ? { driveId } : {})
    .fetchFileContentById(fileId)
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

// Loads the PDF binary as a blob URL for the EmbedPDF viewer, revoked on unmount.
const usePdfBlobUrl = (client, fileId, driveId) => {
  const [state, setState] = useState({ status: 'loading', url: null })

  useEffect(() => {
    let cancelled = false
    let createdUrl = null
    const load = async () => {
      try {
        const url = await readPdfBlobUrl(client, fileId, driveId)
        createdUrl = url
        if (cancelled) URL.revokeObjectURL(url)
        else setState({ status: 'loaded', url })
      } catch (error) {
        logger.error(`Reading PDF failed: ${error}`)
        if (!cancelled) setState({ status: 'error', url: null })
      }
    }
    load()
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [client, fileId, driveId])

  return state
}

/**
 * Loads a PDF from its file binary as a blob URL for the EmbedPDF viewer and
 * persists the edited document back to the binary. Saving is wired to the
 * EmbedPDF registry through `onReady`: it autosaves on annotation changes
 * (debounced), on tab hide and on unmount, and exposes an explicit `save`.
 *
 * @param {object} file - The io.cozy.files document being edited
 * @param {{ isReadOnly?: boolean }} [options]
 * @returns {{ status: string, url: string|null, onReady: Function, save: () => Promise<void>, flush: () => Promise<void>, isSaving: boolean }}
 */
export const usePdfDocument = (file, { isReadOnly = false } = {}) => {
  const client = useClient()
  const registryRef = useRef(null)

  const { status, url } = usePdfBlobUrl(client, file?._id, file?.driveId)
  const { save, flush, scheduleAutosave, isSaving } = usePdfSave({
    client,
    file,
    isReadOnly,
    registryRef
  })

  // Wire the EmbedPDF registry: subscribe to annotation edits to drive autosave.
  const onReady = useCallback(
    registry => {
      registryRef.current = registry
      if (isReadOnly) return
      const annotation = registry.getPlugin('annotation')?.provides()
      annotation?.onAnnotationEvent?.(() => scheduleAutosave())
    },
    [isReadOnly, scheduleAutosave]
  )

  return { status, url, onReady, save, flush, isSaving }
}
