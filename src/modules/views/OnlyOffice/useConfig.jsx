import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useClient, isQueryLoading, generateWebLink } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import {
  shouldBeOpenedOnOtherInstance,
  isOfficeEnabled
} from '@/modules/views/OnlyOffice/helpers'
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
        const {
          protocol,
          instance,
          document_id,
          subdomain,
          sharecode,
          public_name
        } = data.data.attributes

        const searchParams = [['sharecode', sharecode]]
        searchParams.push(['isOnlyOfficeDocShared', true])
        searchParams.push(['onlyOfficeDocId', document_id])
        if (currentSearchParams.get('redirectLink')) {
          searchParams.push([
            'redirectLink',
            currentSearchParams.get('redirectLink')
          ])
        }
        if (public_name) searchParams.push(['username', public_name])

        const link = generateWebLink({
          cozyUrl: `${protocol}://${instance}`,
          searchParams,
          pathname: '/public/',
          slug: 'drive',
          subDomainType: subdomain
        })

        window.location = link
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
