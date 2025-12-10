import { useEffect, useState, useMemo } from 'react'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { uploadFileWithConflictStrategy } from 'cozy-client/dist/models/file'

import logger from '@/lib/logger'
import {
  makeExtByClass,
  makeMimeByClass
} from '@/modules/views/OnlyOffice/helpers'

const useCreateFile = (folderId, fileClass, driveId = undefined) => {
  const [status, setStatus] = useState('pending')
  const [fileId, setFileId] = useState(null)
  const { t } = useI18n()
  const client = useClient()

  const fileExt = useMemo(() => makeExtByClass(fileClass), [fileClass])
  const fileMime = useMemo(() => makeMimeByClass(fileClass), [fileClass])
  const fileUrl = useMemo(
    () => `/onlyOffice/${fileClass}.${fileExt}`,
    [fileClass, fileExt]
  )
  const fileName = useMemo(
    () => t(`OnlyOffice.createFileName.${fileClass}`) + `.${fileExt}`,
    [t, fileClass, fileExt]
  )

  useEffect(() => {
    const doCreate = async () => {
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const { data: createdFile } = await uploadFileWithConflictStrategy(
            client,
            reader.result,
            {
              name: fileName,
              dirId: folderId,
              conflictStrategy: 'rename',
              driveId,
              contentType: fileMime
            }
          )
          setStatus('loaded')
          setFileId(createdFile.id)
        } catch (error) {
          logger.error(`Creating Only Office file failed: ${error}`)
          setStatus('error')
        }
      }

      try {
        const res = await fetch(fileUrl)
        const data = await res.blob()
        reader.readAsArrayBuffer(data)
      } catch (error) {
        logger.error(`Fetching Only Office template file failed: ${error}`)
        setStatus('error')
      }
    }

    doCreate()
  }, [fileClass, fileUrl, folderId, fileMime, fileName, driveId, client])

  return { status, fileId }
}

export default useCreateFile
