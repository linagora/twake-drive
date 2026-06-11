import { useCallback, useRef, useState } from 'react'

import logger from '@/lib/logger'
import { PDF_MIME } from '@/modules/views/Pdf/helpers'
import { updateFileBinary } from '@/modules/views/editor/helpers'
import { useSaveOnHideAndUnmount } from '@/modules/views/editor/useSaveOnHideAndUnmount'

const AUTOSAVE_DEBOUNCE_MS = 3000

const getActiveDocument = registry =>
  registry.getPlugin('document-manager')?.provides()?.getActiveDocument()

// Finalize pending annotation work before serializing. Deselecting flushes the
// annotation the user is still editing (e.g. the text of a FreeText lives in a
// contenteditable overlay until it loses focus) and commit() bakes all pending
// annotations into the PDF document. Without this, hitting Save while an
// annotation is still being edited exports it empty and the edit is lost.
const finalizePendingAnnotations = async registry => {
  const annotation = registry.getPlugin('annotation')?.provides()
  if (!annotation) return
  annotation.deselectAnnotation?.()
  if (annotation.commit) await annotation.commit().toPromise()
}

// Pulls the current document bytes out of the EmbedPDF engine (annotations and
// edits baked in), ready to persist.
const exportPdf = async registry => {
  const engine = registry.getEngine()
  const document = getActiveDocument(registry)
  if (!engine || !document) return null
  await finalizePendingAnnotations(registry)
  return engine.saveAsCopy(document).toPromise()
}

/**
 * Persists the edited document back to the binary. Exposes an explicit save, a
 * flush (cancels the pending autosave then saves) and a scheduleAutosave used to
 * debounce saves on annotation changes. Also saves on tab hide and on unmount.
 *
 * @returns {{ save: () => Promise<void>, flush: () => Promise<void>, scheduleAutosave: () => void, isSaving: boolean }}
 */
export const usePdfSave = ({ client, file, isReadOnly, registryRef }) => {
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = useRef(false)
  const debounceRef = useRef(null)

  const save = useCallback(async () => {
    const registry = registryRef.current
    if (isReadOnly || !registry || !isDirty.current) return
    isDirty.current = false
    setIsSaving(true)
    try {
      const bytes = await exportPdf(registry)
      if (bytes) {
        const blob = new Blob([bytes], { type: PDF_MIME })
        await updateFileBinary(client, file, blob, PDF_MIME)
      }
    } catch (error) {
      isDirty.current = true
      logger.error(`Saving PDF failed: ${error}`)
    } finally {
      setIsSaving(false)
    }
  }, [client, file, isReadOnly, registryRef])

  const flush = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await save()
  }, [save])

  const scheduleAutosave = useCallback(() => {
    isDirty.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(save, AUTOSAVE_DEBOUNCE_MS)
  }, [save])

  useSaveOnHideAndUnmount(flush)

  return { save, flush, scheduleAutosave, isSaving }
}
