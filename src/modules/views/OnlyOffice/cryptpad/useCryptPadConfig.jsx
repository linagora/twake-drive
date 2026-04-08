import { useEffect, useState, useCallback, useRef } from 'react'

import { useClient } from 'cozy-client'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import {
  convertToInternal,
  getDocumentType,
  destroyConverter
} from '@/modules/views/OnlyOffice/cryptpad/converter'

/**
 * Get file extension from filename.
 * @param {string} name
 * @returns {string}
 */
const getFileExtension = name => {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

/**
 * Hook that replaces useConfig for CryptPad mode.
 *
 * Instead of calling the /office API and relying on an OnlyOffice server,
 * this hook:
 * 1. Downloads the file directly via cozy-client
 * 2. Converts it to OnlyOffice internal .bin format using x2t-wasm
 * 3. Creates a blob URL for the .bin content
 * 4. Builds a DocEditor config compatible with CryptPad's onlyoffice-editor wrapper
 *
 * Unlike the server-mode useConfig, this hook does NOT reset config when
 * editor mode changes. The CryptPad-wrapped editor handles mode switching
 * internally and the blob URL must remain valid for the editor's lifetime.
 */
const useCryptPadConfig = () => {
  const { fileId, editorMode, setOfficeKey, file } = useOnlyOfficeContext()

  const client = useClient()
  const [config, setConfig] = useState(null)
  const [status, setStatus] = useState('loading')
  const blobUrlRef = useRef(null)
  const loadedRef = useRef(false)

  const loadDocument = useCallback(async () => {
    // Only load once — the editor keeps the document in memory after that
    if (!file || loadedRef.current) return
    loadedRef.current = true

    try {
      setStatus('loading')

      // Download file content directly from cozy-stack.
      // Use cache: 'no-store' to avoid serving stale content after edits.
      const downloadResp = await client.stackClient.fetch(
        'GET',
        `/files/download/${fileId}`,
        undefined,
        { headers: { Accept: '*/*' }, cache: 'no-store' }
      )
      const arrayBuffer = await downloadResp.arrayBuffer()
      const fileData = new Uint8Array(arrayBuffer)
      console.log('[CryptPad] Downloaded file:', fileData.byteLength, 'bytes')

      const ext = getFileExtension(file.name)
      const documentType = getDocumentType(ext)

      // Convert to OnlyOffice internal .bin format
      const binData = await convertToInternal(fileData, ext)

      console.log('[CryptPad] Conversion result:', {
        inputSize: fileData.byteLength,
        outputSize: binData.byteLength,
        firstBytes: Array.from(binData.slice(0, 16))
      })

      const binBlob = new Blob([binData], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(binBlob)
      blobUrlRef.current = url

      setOfficeKey(fileId)

      // Build the editor API URL (served from vendor directory)
      const apiUrl = '/vendor/cryptpad-onlyoffice/editor/web-apps/apps/api/documents/api.js'

      // Build DocEditor config compatible with CryptPad's wrapper.
      // Mode is set to 'edit' so the editor loads with full capabilities.
      // View-only restriction is handled by the OnlyOffice UI layer.
      const docEditorConfig = {
        document: {
          fileType: ext,
          key: fileId,
          title: file.name,
          url, // blob URL to the .bin content
          permissions: {
            download: false,
            print: true
          }
        },
        documentType,
        editorConfig: {
          mode: editorMode,
          lang: document.documentElement.lang || 'en',
          customization: {
            compactHeader: true,
            chat: false,
            comments: false,
            reviewDisplay: 'markup',
            hideRightMenu: true
          }
        }
      }

      setConfig({
        apiUrl,
        docEditorConfig,
        isCryptPad: true
      })
      setStatus('loaded')
    } catch (error) {
      console.error('CryptPad config loading failed:', error)
      loadedRef.current = false
      setStatus('error')
    }
  }, [file, fileId, client, editorMode, setOfficeKey])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  // Clean up blob URL and converter on unmount only.
  // The blob URL must stay valid for the editor's entire lifetime.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      destroyConverter()
    }
  }, [])

  return { config, status }
}

export default useCryptPadConfig
