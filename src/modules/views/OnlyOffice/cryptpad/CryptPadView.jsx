import PropTypes from 'prop-types'
import React, { useEffect, useCallback, useState, useRef } from 'react'

import { useClient } from 'cozy-client'
import Spinner from 'cozy-ui/transpiled/react/Spinner'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import Error from '@/modules/views/OnlyOffice/Error'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { convertFromInternal } from '@/modules/views/OnlyOffice/cryptpad/converter'

const EDITOR_IFRAME_NAME = 'frameEditor'

/**
 * Get the internal OnlyOffice editor instance from the iframe.
 * The editor lives inside the first iframe created by DocsAPI.DocEditor.
 * sdkjs exposes the editor as a global variable in the iframe window.
 */
const getOOEditor = () => {
  const iframe = document.getElementsByName(EDITOR_IFRAME_NAME)[0]
  if (!iframe || !iframe.contentWindow) return null

  const win = iframe.contentWindow

  // OnlyOffice exposes different editor objects depending on document type.
  // Log available objects for debugging.
  const found =
    win.editor || win.editorCell || win.editorPresentation || null

  if (!found) {
    // Look for the editor API on the Asc global (sdkjs exposes it there)
    const api =
      win.Asc && (win.Asc.editor || win.Asc.spreadsheet_api || null)
    if (api) return api

    console.warn('[CryptPad] Editor not found on iframe window. Available keys:',
      Object.keys(win).filter(k =>
        k.toLowerCase().includes('editor') ||
        k.toLowerCase().includes('asc') ||
        k.toLowerCase().includes('api')
      )
    )
  }

  return found
}

/**
 * Get the file extension from the filename.
 */
const getFileExtension = name => {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

/**
 * Intercept XMLHttpRequest to handle /downloadas/ requests locally.
 * The OnlyOffice editor tries to save via HTTP to a Document Server that
 * doesn't exist in CryptPad mode. We intercept these requests and return
 * a fake success response to prevent 405 errors.
 */
const patchXHRForDownloadAs = () => {
  const OrigXHR = window.XMLHttpRequest
  const patchedOpen = OrigXHR.prototype.open

  if (patchedOpen._cryptpadPatched) return

  const originalOpen = patchedOpen
  OrigXHR.prototype.open = function (method, url, ...args) {
    if (typeof url === 'string' && url.includes('/downloadas/')) {
      console.log('[CryptPad] Intercepted /downloadas/ request:', url)
      this._isCryptPadIntercepted = true
    }
    return originalOpen.call(this, method, url, ...args)
  }
  OrigXHR.prototype.open._cryptpadPatched = true

  const originalSend = OrigXHR.prototype.send
  OrigXHR.prototype.send = function (...args) {
    if (this._isCryptPadIntercepted) {
      // Simulate a successful empty response
      Object.defineProperty(this, 'status', { value: 200 })
      Object.defineProperty(this, 'readyState', { value: 4 })
      Object.defineProperty(this, 'responseText', { value: '{}' })
      setTimeout(() => {
        if (typeof this.onload === 'function') this.onload()
        this.dispatchEvent(new Event('load'))
        this.dispatchEvent(new Event('loadend'))
      }, 0)
      return
    }
    return originalSend.call(this, ...args)
  }
}

/**
 * CryptPadView renders the OnlyOffice editor using CryptPad's client-side
 * wrapper (onlyoffice-editor). It replaces the standard View.jsx when
 * CryptPad mode is enabled.
 *
 * Key differences from legacy View.jsx:
 * - Loads the SDK from local vendor/ directory instead of a remote server
 * - Uses connectMockServer() to handle the OnlyOffice protocol locally
 * - No server callbacks — saves directly to cozy-stack via cozy-client
 */
const CryptPadView = ({ apiUrl, docEditorConfig }) => {
  const [isError, setIsError] = useState(false)
  const docEditorRef = useRef(null)
  const saveTimerRef = useRef(null)
  const client = useClient()

  const { isEditorReady, setIsEditorReady, editorMode, fileId, file } =
    useOnlyOfficeContext()

  // Use a ref to always have the current editorMode in message handlers
  const editorModeRef = useRef(editorMode)
  useEffect(() => {
    editorModeRef.current = editorMode
  }, [editorMode])

  /**
   * Save the current document back to cozy-stack.
   * Gets the .bin content from the editor, converts it back to the
   * original format (docx/xlsx/pptx), and uploads it.
   */
  const saveDocument = useCallback(async () => {
    console.log('[CryptPad] saveDocument called, mode:', editorModeRef.current)
    if (editorModeRef.current !== 'edit') return

    const editor = getOOEditor()
    console.log('[CryptPad] editor instance:', editor ? 'found' : 'NOT FOUND')
    if (!editor) {
      console.warn('[CryptPad] Cannot save: editor not available')
      return
    }

    try {
      // Get the document content from the editor.
      // asc_nativeGetFile2 returns a base64-encoded string of the internal
      // DOCY/XLSY/PPTY format. We try multiple methods as fallbacks.
      let exportData = null
      for (const method of ['asc_nativeGetFile2', 'asc_nativeGetFile', 'asc_nativeGetFile3']) {
        try {
          if (typeof editor[method] !== 'function') continue
          const result = editor[method]()
          if (result && (result.byteLength || result.length) > 0) {
            exportData = result
            console.log(`[CryptPad] ${method} returned ${typeof result}, length: ${result.byteLength || result.length}`)
            break
          }
        } catch (e) {
          console.warn(`[CryptPad] ${method} failed:`, e.message)
        }
      }

      if (!exportData) {
        console.warn('[CryptPad] Cannot save: no export method returned data')
        return
      }

      // The editor returns a base64-encoded string of the internal format
      // (starts with "DOCY;", "XLSY;", or "PPTY;"). Decode it to binary.
      let rawData
      if (typeof exportData === 'string') {
        const binaryString = atob(exportData)
        rawData = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          rawData[i] = binaryString.charCodeAt(i)
        }
        console.log('[CryptPad] Decoded base64 →', rawData.byteLength, 'bytes, header:', String.fromCharCode(...rawData.slice(0, 12)))
      } else {
        // Typed array from iframe — copy cross-frame
        const len = exportData.byteLength ?? exportData.length ?? 0
        rawData = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          rawData[i] = exportData[i]
        }
      }

      const ext = getFileExtension(file.name)

      // Convert internal format back to the original Office format
      const fileData = await convertFromInternal(rawData, ext)
      console.log('[CryptPad] Converted back to', ext, ':', fileData.byteLength, 'bytes')

      // Verify fileData is a valid main-frame Uint8Array
      console.log('[CryptPad] fileData type:', fileData.constructor.name,
        'instanceof Uint8Array:', fileData instanceof Uint8Array,
        'byteLength:', fileData.byteLength,
        'first 4 bytes:', Array.from(fileData.slice(0, 4)))

      const blob = new Blob([fileData], { type: file.mime })
      console.log('[CryptPad] Blob created:', blob.size, 'bytes, type:', blob.type)

      // Upload back to cozy-stack, overwriting the existing file
      const resp = await client
        .collection(DOCTYPE_FILES)
        .updateFile(blob, {
          fileId,
          name: file.name,
          contentLength: blob.size
        })
      console.log('[CryptPad] Save response:', JSON.stringify({
        id: resp?.data?.id || resp?.data?._id,
        size: resp?.data?.size || resp?.data?.attributes?.size,
        rev: resp?.data?._rev || resp?.data?.meta?.rev,
        name: resp?.data?.name || resp?.data?.attributes?.name
      }))
    } catch (error) {
      console.error('[CryptPad] Failed to save document:', error)
    }
  }, [client, file, fileId])

  /**
   * Schedule a debounced save. Called after each `saveChanges` message
   * from the editor. Waits 2 seconds of inactivity before saving to
   * avoid uploading on every keystroke.
   */
  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      saveDocument()
    }, 2000)
  }, [saveDocument])

  /**
   * Initialize the CryptPad-wrapped OnlyOffice editor.
   * The wrapper's api.js replaces DocsAPI.DocEditor with its own class
   * that supports connectMockServer().
   */
  const initEditor = useCallback(() => {
    try {
      // CryptPad's wrapper expects window.APP to exist — it sets
      // window.APP.getImageURL during connectMockServer().
      if (!window.APP) {
        window.APP = {}
      }

      // Intercept /downloadas/ HTTP requests that the editor makes
      // when trying to save through the (non-existent) Document Server.
      patchXHRForDownloadAs()

      // Also patch the iframe's XHR once it's created
      const patchIframeXHR = () => {
        const iframe = document.getElementsByName(EDITOR_IFRAME_NAME)[0]
        if (iframe && iframe.contentWindow) {
          const IframeXHR = iframe.contentWindow.XMLHttpRequest
          if (IframeXHR && !IframeXHR.prototype.open._cryptpadPatched) {
            const origOpen = IframeXHR.prototype.open
            IframeXHR.prototype.open = function (method, url, ...args) {
              if (typeof url === 'string' && url.includes('/downloadas/')) {
                console.log('[CryptPad] Intercepted iframe /downloadas/ request')
                this._isCryptPadIntercepted = true
              }
              return origOpen.call(this, method, url, ...args)
            }
            IframeXHR.prototype.open._cryptpadPatched = true

            const origSend = IframeXHR.prototype.send
            IframeXHR.prototype.send = function (...args) {
              if (this._isCryptPadIntercepted) {
                Object.defineProperty(this, 'status', { value: 200 })
                Object.defineProperty(this, 'readyState', { value: 4 })
                Object.defineProperty(this, 'responseText', { value: '{}' })
                setTimeout(() => {
                  if (typeof this.onload === 'function') this.onload()
                  this.dispatchEvent(new Event('load'))
                  this.dispatchEvent(new Event('loadend'))
                }, 0)
                return
              }
              return origSend.call(this, ...args)
            }
          }
        }
      }

      const editor = new window.DocsAPI.DocEditor(
        'onlyOfficeEditor',
        docEditorConfig
      )
      docEditorRef.current = editor

      // Connect the mock server that replaces OnlyOffice Document Server.
      // This handles the auth handshake, document loading, and message routing.
      editor.connectMockServer({
        getParticipants: () => ({
          index: 0,
          list: [
            {
              id: 1,
              idOriginal: 'user-1',
              username: 'User',
              indexUser: 0,
              connectionId: 'conn-1',
              isCloseCoAuthoring: false,
              view: editorModeRef.current === 'view'
            }
          ]
        }),

        onAuth: () => {
          // Auth completed — mark editor as ready.
          setIsEditorReady(true)
          // Patch iframe XHR after the iframe is fully set up
          setTimeout(patchIframeXHR, 1000)
        },

        onMessage: msg => {
          console.log('[CryptPad] Message from editor:', msg.type)

          // Handle messages from OnlyOffice editor
          switch (msg.type) {
            case 'isSaveLock':
              // Respond that save is not locked
              editor.sendMessageToOO({
                type: 'saveLock',
                saveLock: false
              })
              break

            case 'saveChanges':
              // Single-user mode: acknowledge the save immediately
              editor.sendMessageToOO({
                type: 'unSaveLock',
                index: msg.changesIndex,
                time: Date.now()
              })
              // Schedule a debounced save to cozy-stack
              debouncedSave()
              break

            case 'getLock':
              // Single-user mode: grant lock immediately
              editor.sendMessageToOO({
                type: 'getLock',
                locks: []
              })
              break

            case 'getMessages':
              // No chat in single-user mode
              editor.sendMessageToOO({ type: 'message' })
              break

            case 'unLockDocument':
              // Document unlocked after editing — trigger save
              saveDocument()
              break

            case 'forceSaveStart':
              // Manual save triggered (Ctrl+S)
              saveDocument()
              editor.sendMessageToOO({
                type: 'forceSave',
                success: true
              })
              break

            default:
              break
          }
        }
      })
    } catch (error) {
      console.error('Failed to initialize CryptPad editor:', error)
      setIsError(true)
    }
  }, [docEditorConfig, saveDocument, debouncedSave, setIsEditorReady])

  const handleError = useCallback(() => {
    setIsError(true)
  }, [])

  // Load the CryptPad-wrapped OnlyOffice SDK, then initialize the editor.
  useEffect(() => {
    let cancelled = false

    const waitForDocsAPI = () => {
      return new Promise((resolve, reject) => {
        if (window.DocsAPI && window.DocsAPI.DocEditor) {
          resolve()
          return
        }
        let attempts = 0
        const maxAttempts = 100
        const interval = setInterval(() => {
          if (cancelled) {
            clearInterval(interval)
            return
          }
          if (window.DocsAPI && window.DocsAPI.DocEditor) {
            clearInterval(interval)
            resolve()
          } else if (++attempts >= maxAttempts) {
            clearInterval(interval)
            reject(new Error('Timed out waiting for OnlyOffice SDK'))
          }
        }, 100)
      })
    }

    const loadAndInit = async () => {
      try {
        const scriptId = 'cryptpad-onlyoffice-sdk'
        const scriptAlreadyLoaded = document.getElementById(scriptId)

        if (!scriptAlreadyLoaded) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.id = scriptId
            script.src = apiUrl
            script.async = true
            script.onload = resolve
            script.onerror = () =>
              reject(new Error('Failed to load OnlyOffice SDK'))
            document.body.appendChild(script)
          })
        }

        await waitForDocsAPI()

        if (!cancelled) {
          initEditor()
        }
      } catch (error) {
        console.error('SDK loading failed:', error)
        if (!cancelled) {
          handleError()
        }
      }
    }

    loadAndInit()

    return () => {
      cancelled = true
    }
  }, [apiUrl, initEditor, handleError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      if (docEditorRef.current) {
        try {
          docEditorRef.current.destroyEditor()
        } catch (e) {
          // Ignore cleanup errors
        }
        docEditorRef.current = null
      }
    }
  }, [])

  if (isError) return <Error />

  return (
    <>
      {!isEditorReady && (
        <div className="u-flex u-flex-items-center u-flex-justify-center u-flex-grow-1">
          <Spinner size="xxlarge" />
        </div>
      )}
      <div className="u-flex u-flex-grow-1">
        <div id="onlyOfficeEditor" />
      </div>
    </>
  )
}

CryptPadView.propTypes = {
  apiUrl: PropTypes.string.isRequired,
  docEditorConfig: PropTypes.object.isRequired
}

export default React.memo(CryptPadView)
