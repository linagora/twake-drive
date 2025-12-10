import { useState, useEffect, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { useWebviewIntent } from 'cozy-intent'
import logger from 'cozy-logger'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import {
  getErrorMessage,
  getFileFromBase64,
  getUniqueNameFromPrefix
} from '@/modules/drive/helpers'
import { uploadFiles } from '@/modules/navigation/duck'

/**
 * Custom hook that provides scanner functionality.
 * @returns An object with the following properties:
 *   - hasScanner: A boolean indicating whether the scanner is available.
 *   - scanDocument: A function that returns a promise resolving to a string representing the scanned document in base64 format.
 */
export const useScannerService = (displayedFolder: {
  id: string
  driveId: string
}): {
  hasScanner: boolean
  startScanner: () => Promise<void>
} => {
  const [hasScanner, setHasScanner] = useState(false)
  const webviewIntent = useWebviewIntent()
  const dispatch = useDispatch()
  const client = useClient()
  const { t } = useI18n()
  const { showAlert } = useAlert()

  useEffect(() => {
    const initScanner = async (): Promise<void> => {
      try {
        const res = await webviewIntent?.call('isAvailable', 'scanner')
        setHasScanner(Boolean(res))
      } catch (error) {
        logger('error', `scanner won't be available, ${getErrorMessage(error)}`)
      }
    }

    if (webviewIntent) {
      void initScanner()
    }
  }, [webviewIntent])

  const scanDocument = useCallback(async (): Promise<string> => {
    logger('info', 'Starting scanner')
    const base64 = (await webviewIntent?.call(
      'scanDocument'
    )) as unknown as string

    if (!base64) throw new Error('No base64 returned by scanDocument')

    logger('info', `Scan done, base64 trimmed: ${base64.slice(0, 20)}...`)
    return base64
  }, [webviewIntent])

  const startScanner = useCallback(async () => {
    try {
      if (!displayedFolder) return

      const base64 = await scanDocument()

      const payload = uploadFiles(
        [
          getFileFromBase64(
            base64,
            getUniqueNameFromPrefix('scan'),
            'image/jpeg'
          )
        ],
        displayedFolder.id,
        { isScanned: true },
        () => logger('info', `File uploaded successfully`),
        { client, vaultClient: {}, showAlert, t },
        displayedFolder.driveId,
        undefined
      )

      dispatch(payload)
    } catch (error) {
      logger('error', `startScanner error, ${getErrorMessage(error)}`)
      showAlert({ message: t('ImportToDrive.error'), severity: 'error' })
    }
  }, [displayedFolder, scanDocument, dispatch, client, t, showAlert])

  return { hasScanner, startScanner }
}
