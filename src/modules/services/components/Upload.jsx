import { useEffect } from 'react'

import { useClient } from 'cozy-client'

import {
  isFilesUpload,
  uploadFilesToDrive
} from '@/modules/services/uploadFiles'
import {
  normalizeUrlUploadError,
  uploadFileFromUrl
} from '@/modules/services/uploadFromUrl'

export function Upload({ service }) {
  const client = useClient()

  useEffect(() => {
    const controller = new AbortController()
    const handleClose = () => controller.abort()
    window.addEventListener('pagehide', handleClose)
    let hasTerminated = false

    const startUpload = async () => {
      const data = service.getData()
      const isFiles = isFilesUpload(data)
      try {
        // Let React's effect cleanup cancel a discarded mount before any I/O.
        await Promise.resolve()
        if (controller.signal.aborted) return
        const onProgress =
          data.progress === true
            ? progress => service.sendResult(progress)
            : null
        const document = isFiles
          ? await uploadFilesToDrive(
              client,
              data,
              controller.signal,
              onProgress
            )
          : await uploadFileFromUrl(client, data, controller.signal)
        if (!controller.signal.aborted) {
          hasTerminated = true
          service.terminate(document)
        }
      } catch (error) {
        if (controller.signal.aborted || hasTerminated) return
        hasTerminated = true
        service.throw(isFiles ? error : normalizeUrlUploadError(error))
      }
    }

    startUpload()
    return () => {
      window.removeEventListener('pagehide', handleClose)
      controller.abort()
    }
  }, [client, service])

  return null
}
