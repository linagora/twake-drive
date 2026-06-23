import { WebviewService } from 'cozy-intent'
import logger from 'cozy-logger'

import { RECEIVE_UPLOAD_ERROR, RECEIVE_UPLOAD_SUCCESS } from '@/modules/upload'
import type {
  FileFromNative,
  FileForQueue
} from '@/modules/views/Upload/UploadTypes'

export const generateForQueue = (
  files: FileFromNative['file'][]
): FileForQueue[] => {
  // @ts-expect-error fix file types mismatch
  return files.map(file => ({ file: file, isDirectory: false }))
}

export const onFileUploaded = (
  data: {
    file: FileFromNative
    isSuccess: boolean
  },
  dispatch: (arg0: { type: string; file: FileFromNative }) => void
): void => {
  if (!data.file) return

  // Status 2 means file status is "uploaded", any other status should be considered as an error,
  // though it is not intended to receive something else than "uploaded" (2) or "error" (3)
  // See OsReceiveFileStatus enum in cozy-flagship
  if (data.file.status === 2) {
    dispatch({ type: RECEIVE_UPLOAD_SUCCESS, file: data.file })
  } else {
    dispatch({ type: RECEIVE_UPLOAD_ERROR, file: data.file })
  }
}

export const shouldRender = (
  items?: FileFromNative['file'][]
): items is FileFromNative['file'][] => !!items && items.length > 0

export const getFilesToHandle = async (
  webviewIntent: WebviewService
): Promise<(FileFromNative['file'] & { name: string })[]> => {
  logger('info', 'getFilesToHandle called')

  const files = (await webviewIntent.call(
    'getFilesToHandle'
  )) as unknown as FileFromNative[]

  if (files.length === 0) throw new Error('No files to upload')

  if (files.length > 0) {
    logger('info', 'getFilesToHandle success')

    return files.map(fileFromNative => ({
      ...fileFromNative.file,
      name: fileFromNative.file.fileName
    }))
  } else {
    logger('info', 'getFilesToHandle no files to upload')
    throw new Error('No files to upload')
  }
}

export const sendFilesToHandle = (
  filesForQueue: FileForQueue[],
  webviewIntent: WebviewService,
  folderId: string
): void => {
  const filesToUpload = filesForQueue.map(file => {
    if (!file.file) throw new Error('No file to upload')

    return {
      fileOptions: {
        name: file.file.name,
        dirId: folderId
      }
    }
  })

  logger('info', 'uploadFilesFromFlagship called')

  void webviewIntent.call('uploadFiles', JSON.stringify(filesToUpload))

  logger('info', 'uploadFilesFromFlagship success')
}
