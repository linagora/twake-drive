import { useCallback, useEffect, useRef, useState } from 'react'

import { useClient } from 'cozy-client'

import logger from '@/lib/logger'
import { PDF_MIME } from '@/modules/views/Pdf/helpers'

const AUTOSAVE_DEBOUNCE_MS = 3000

const readPdfBlobUrl = async (client, fileId, driveId) => {
  const response = await client
    .collection('io.cozy.files', driveId ? { driveId } : {})
    .fetchFileContentById(fileId)
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

const writePdfToBinary = (client, file, arrayBuffer) =>
  client
    .collection('io.cozy.files', file.driveId ? { driveId: file.driveId } : {})
    .updateFile(new Blob([arrayBuffer], { type: PDF_MIME }), {
      fileId: file._id,
      name: file.name,
      contentType: PDF_MIME
    })

// Pulls the current document bytes out of the EmbedPDF engine (annotations and
// edits baked in), ready to persist.
const exportPdf = async registry => {
  const engine = registry.getEngine()
  const document = registry
    .getPlugin('document-manager')
    ?.provides()
    ?.getActiveDocument()
  if (!engine || !document) return null

  // Finalize pending annotation work before serializing. Deselecting flushes
  // the annotation the user is still editing (e.g. the text of a FreeText lives
  // in a contenteditable overlay until it loses focus) and commit() bakes all
  // pending annotations into the PDF document. Without this, hitting Save while
  // an annotation is still being edited exports it empty and the edit is lost.
  const annotation = registry.getPlugin('annotation')?.provides()
  annotation?.deselectAnnotation?.()
  if (annotation?.commit) {
    await annotation.commit().toPromise()
  }

  return engine.saveAsCopy(document).toPromise()
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
  const fileId = file?._id
  const driveId = file?.driveId

  const [state, setState] = useState({ status: 'loading', url: null })
  const [isSaving, setIsSaving] = useState(false)

  const registryRef = useRef(null)
  const isDirty = useRef(false)
  const debounceRef = useRef(null)

  // Load the binary as a blob URL, revoked on unmount.
  useEffect(() => {
    let cancelled = false
    let createdUrl = null
    const load = async () => {
      try {
        const url = await readPdfBlobUrl(client, fileId, driveId)
        createdUrl = url
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        setState({ status: 'loaded', url })
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

  const save = useCallback(async () => {
    const registry = registryRef.current
    if (isReadOnly || !registry || !isDirty.current) return
    isDirty.current = false
    setIsSaving(true)
    try {
      const bytes = await exportPdf(registry)
      if (bytes) await writePdfToBinary(client, file, bytes)
    } catch (error) {
      isDirty.current = true
      logger.error(`Saving PDF failed: ${error}`)
    } finally {
      setIsSaving(false)
    }
  }, [client, file, isReadOnly])

  const flush = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await save()
  }, [save])

  const scheduleAutosave = useCallback(() => {
    isDirty.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(), AUTOSAVE_DEBOUNCE_MS)
  }, [save])

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

  // Save on tab hide and on unmount.
  useEffect(() => {
    if (isReadOnly) return undefined
    const handleHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', handleHide)
    return () => {
      document.removeEventListener('visibilitychange', handleHide)
      flush()
    }
  }, [flush, isReadOnly])

  return {
    status: state.status,
    url: state.url,
    onReady,
    save,
    flush,
    isSaving
  }
}
