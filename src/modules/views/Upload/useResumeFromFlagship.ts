import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { useClient } from 'cozy-client'
import { useWebviewIntent } from 'cozy-intent'
import logger from 'cozy-logger'

import { getErrorMessage } from '@/modules/drive/helpers'
import { getUploadQueue, ADD_TO_UPLOAD_QUEUE } from '@/modules/upload'
import { FileFromNative } from '@/modules/views/Upload/UploadTypes'

export const useResumeUploadFromFlagship = (): void => {
  const client = useClient()
  const dispatch = useDispatch()
  const webviewIntent = useWebviewIntent()
  const uploadQueue = useSelector(getUploadQueue) as FileFromNative[]

  useEffect(() => {
    const doResumeCheck = async (): Promise<void> => {
      if (!webviewIntent || uploadQueue.length > 0) return

      try {
        const { filesToHandle } = (await webviewIntent.call(
          'hasFilesToHandle'
        )) as unknown as {
          filesToHandle: FileFromNative[]
        }

        if (!filesToHandle || filesToHandle.length === 0) return

        dispatch({
          type: ADD_TO_UPLOAD_QUEUE,
          files: filesToHandle
        })
      } catch (error) {
        const errorMessage = getErrorMessage(error)
        logger('info', `hasFilesToHandle error, ${errorMessage}`)

        // It means we're on a cozy-flagship version that doesn't handle file sharing
        // In that case we don't want to do anything and just let the upload queue empty
        if (errorMessage.includes('has not been implemented')) return
      }
    }

    void doResumeCheck()
  }, [client, dispatch, webviewIntent, uploadQueue])
}
