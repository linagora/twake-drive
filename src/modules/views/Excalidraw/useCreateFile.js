import { useEffect, useState } from 'react'

import { useClient } from 'cozy-client'
import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'
import { useI18n } from 'twake-i18n'

import logger from '@/lib/logger'
import {
  makeEmptyScene,
  EXCALIDRAW_EXTENSION,
  EXCALIDRAW_MIME
} from '@/modules/views/Excalidraw/helpers'

/**
 * Creates a new, empty Excalidraw file in the given folder and exposes its
 * creation status and resulting id.
 *
 * Unlike OnlyOffice, the template does not need a static asset: the empty scene
 * is generated in memory.
 *
 * @param {string} folderId - Destination folder id
 * @param {string} [driveId] - Shared drive id, when relevant
 * @returns {{ status: string, fileId: string|null }}
 */
export const useCreateFile = (folderId, driveId = undefined) => {
  const [status, setStatus] = useState('pending')
  const [fileId, setFileId] = useState(null)
  const { t } = useI18n()
  const client = useClient()

  useEffect(() => {
    let cancelled = false

    const doCreate = async () => {
      try {
        const fileName = `${t('Excalidraw.createFileName')}.${EXCALIDRAW_EXTENSION}`
        // The file body is the scene: a .excalidraw is a JSON file the editor
        // reads from and writes back to. Seed its source with the instance URL.
        const source = client.getStackClient().uri
        const content = JSON.stringify(makeEmptyScene(source))
        const { data: createdFile } = await uploadFileWithConflictStrategy(
          client,
          content,
          {
            name: fileName,
            dirId: folderId,
            conflictStrategy: 'rename',
            driveId,
            contentType: EXCALIDRAW_MIME
          }
        )
        if (cancelled) return
        setFileId(createdFile.id)
        setStatus('loaded')
      } catch (error) {
        logger.error(`Creating Excalidraw file failed: ${error}`)
        if (!cancelled) setStatus('error')
      }
    }

    doCreate()

    return () => {
      cancelled = true
    }
  }, [client, t, folderId, driveId])

  return { status, fileId }
}
