import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useClient, isQueryLoading, generateWebLink } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import {
  shouldBeOpenedOnOtherInstance,
  isOfficeEnabled,
  makeName
} from '@/modules/views/OnlyOffice/helpers'

const useConfig = () => {
  const {
    fileId,
    driveId,
    setIsEditorReady,
    isPublic,
    username,
    isFromSharing,
    editorMode,
    isEditorModeView,
    setOfficeKey
  } = useOnlyOfficeContext()
  const client = useClient()
  const instanceUri = client.getStackClient().uri
  const [currentSearchParams] = useSearchParams()
  // The viewer's own locale. For a shared document opened by a recipient, the
  // editor is rendered on the owner's instance, so we carry this through the
  // redirect (see the `lang` search param below) to keep the editor in the
  // recipient's language instead of the owner's.
  const { lang } = useI18n()

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
        if (lang) searchParams.push(['lang', lang])

        const link = generateWebLink({
          cozyUrl: `${protocol}://${instance}`,
          searchParams,
          pathname: '/public/',
          slug: 'drive',
          subDomainType: subdomain
        })

        window.location = link
      } else if (isOfficeEnabled(isDesktop)) {
        const { attributes } = data.data
        const { onlyoffice, public_name } = attributes
        const name = makeName({
          isPublic,
          isFromSharing,
          username,
          public_name
        })

        setOfficeKey(onlyoffice.document.key)

        const serverUrl = onlyoffice.url
        const apiUrl = `${serverUrl}/web-apps/apps/api/documents/api.js`
        const docEditorConfig = {
          // complete config doc : https://api.onlyoffice.com/editors/advanced
          document: onlyoffice.document,
          editorConfig: {
            ...(onlyoffice.editorConfig ?? onlyoffice.editor),
            // Show the editor in the viewer's language. The backend fills this
            // with the owner's instance locale, which is wrong for a recipient.
            lang,
            mode:
              (onlyoffice.editorConfig?.mode ?? onlyoffice.editor?.mode) ===
              'edit'
                ? editorMode
                : 'view',
            user: { name },
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
    username,
    isFromSharing,
    instanceUri,
    isDesktop,
    currentSearchParams,
    setOfficeKey,
    lang
  ])

  return { config, status }
}

export default useConfig
