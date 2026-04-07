export interface FileForQueue {
  name: string
  file?: { name: string }
  fileId?: string
  isDirectory?: false
}

export interface FileFromNative {
  name: string
  file: {
    weblink: null
    text: null
    filePath: string
    contentUri: string
    subject: null
    extension: string
    fileName: string
    mimeType: string
    dirId?: string
    conflictStrategy?: string
    fromFlagship?: boolean
  }
  status: number
}

export interface UploadFromFlagship {
  items?: FileFromNative['file'][]
  uploadFilesFromFlagship: (folderId: string) => void
  resetFilesToHandle: () => Promise<void>
  onClose: () => Promise<void>
  uploadInProgress: boolean
}
