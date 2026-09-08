import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useClient, isQueryLoading } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { changeLocation } from '@/hooks/helpers'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { isOfficeEnabled } from '@/modules/views/OnlyOffice/helpers'
import {
  makePublicEditorUrl,
  shouldBeOpenedOnOtherInstance
} from '@/modules/views/editor/helpers'
import { useEditorAuthor } from '@/modules/views/editor/useEditorAuthor'

const useConfig = () => {
  const {
    fileId,
    driveId,
    setIsEditorReady,
    isPublic,
    editorMode,
    isEditorModeView,
    setOfficeKey
  } = useOnlyOfficeContext()
  const client = useClient()
  const instanceUri = client.getStackClient().uri
  const [currentSearchParams] = useSearchParams()
  const { author, isLoading: isAuthorLoading } = useEditorAuthor({ isPublic })

  const [config, setConfig] = useState()
  const [status, setStatus] = useState('loading')

  const queryResult = useFetchJSON(
    'GET',
    driveId
      ? `/sharings/drives/${driveId}/office/${fileId}/open`
      : `/office/${fileId}/open`
  )
  const { data, fetchStatus } = queryResult
  const { isDesktop } = useBreakpoints()

  useEffect(() => {
    setStatus(fetchStatus)
  }, [fetchStatus])

  useEffect(() => {
    setConfig()
  }, [isEditorModeView])

  useEffect(() => {
    if (!isQueryLoading(queryResult) && fetchStatus !== 'error' && !config) {
      if (shouldBeOpenedOnOtherInstance(data, instanceUri)) {
        // No hash: the public page routes to the editor from these two params.
        const { document_id } = data.data.attributes

        changeLocation(
          makePublicEditorUrl({
            attributes: data.data.attributes,
            searchParams: [
              ['isOnlyOfficeDocShared', true],
              ['onlyOfficeDocId', document_id]
            ],
            redirectLink: currentSearchParams.get('redirectLink')
          })
        )
      } else if (isOfficeEnabled(isDesktop)) {
        // The editor reads the author from its config at mount, so wait for it.
        if (isAuthorLoading) return

        const { attributes } = data.data
        const { onlyoffice } = attributes

        setOfficeKey(onlyoffice.document.key)

        const serverUrl = onlyoffice.url
        const apiUrl = `${serverUrl}/web-apps/apps/api/documents/api.js`
        const docEditorConfig = {
          // complete config doc : https://api.onlyoffice.com/editors/advanced
          document: onlyoffice.document,
          editorConfig: {
            ...(onlyoffice.editorConfig ?? onlyoffice.editor),
            mode:
              (onlyoffice.editorConfig?.mode ?? onlyoffice.editor?.mode) ===
              'edit'
                ? editorMode
                : 'view',
            user: { name: author },
            customization: {
              reviewDisplay: 'markup'
            }
          },
          token: onlyoffice.token,
          documentType: onlyoffice.documentType,
          events: {
            onAppReady: () => setIsEditorReady(true)
          }
        }

        setConfig({ serverUrl, apiUrl, docEditorConfig })
      } else {
        setStatus('error')
      }
    }
  }, [
    editorMode,
    queryResult,
    fetchStatus,
    data,
    config,
    setConfig,
    setIsEditorReady,
    isPublic,
    author,
    isAuthorLoading,
    instanceUri,
    isDesktop,
    currentSearchParams,
    setOfficeKey
  ])

  return { config, status }
}

export default useConfig
