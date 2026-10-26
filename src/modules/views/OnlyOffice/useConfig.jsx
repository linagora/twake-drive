import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useClient, isQueryLoading } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { changeLocation } from '@/hooks/helpers'
import logger from '@/lib/logger'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { makeOfficeApiUrl } from '@/modules/views/OnlyOffice/apiUrl'
import {
  canOpenPdfWithOnlyOffice,
  isOfficeEnabled
} from '@/modules/views/OnlyOffice/helpers'
import { isPdf } from '@/modules/views/Pdf/helpers'
import {
  makePublicEditorUrl,
  shouldBeOpenedOnOtherInstance
} from '@/modules/views/editor/helpers'
import { useEditorAuthor } from '@/modules/views/editor/useEditorAuthor'

const ONLYOFFICE_AI_PLUGIN = 'asc.{9DC93CDB-B576-4F0C-B55E-FCC9C48DD007}'

const useConfig = () => {
  const {
    fileId,
    driveId,
    setIsEditorReady,
    isPublic,
    isReadOnly,
    editorMode,
    isEditorModeView,
    setOfficeKey
  } = useOnlyOfficeContext()
  const client = useClient()
  const { getSharingById } = useSharingContext()
  const sharing = driveId ? getSharingById(driveId) : null
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
    if (isQueryLoading(queryResult) || fetchStatus === 'error' || config) return

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

      return
    }

    const { onlyoffice } = data.data.attributes
    const isPdfDoc =
      isPdf(data.data) ||
      onlyoffice?.documentType === 'pdf' ||
      onlyoffice?.document?.fileType === 'pdf'
    if (
      !isOfficeEnabled(isDesktop) ||
      (isPdfDoc && !canOpenPdfWithOnlyOffice(isOfficeEnabled(isDesktop)))
    ) {
      setStatus('viewer')
      return
    }

    // The editor reads the author from its config at mount, so wait for it.
    if (isAuthorLoading || (driveId && !sharing)) return

    setOfficeKey(onlyoffice.document.key)

    // Only received drives proxy /open; ownership must come from local sharing state.
    const apiUrl = makeOfficeApiUrl(onlyoffice.url, {
      isServerUrlTrusted: !driveId || sharing?.attributes.owner === true
    })
    if (!apiUrl) {
      logger.error(
        'Refusing the OnlyOffice server URL returned by the open route'
      )
      setStatus('error')
      return
    }

    const serverEditorConfig = onlyoffice.editorConfig ?? onlyoffice.editor
    const docEditorConfig = {
      // complete config doc : https://api.onlyoffice.com/editors/advanced
      document: onlyoffice.document,
      editorConfig: {
        ...serverEditorConfig,
        mode:
          !isReadOnly && serverEditorConfig?.mode === 'edit'
            ? editorMode
            : 'view',
        user: { name: author },
        ...(isPdfDoc && {
          coEditing: { ...serverEditorConfig?.coEditing, mode: 'fast' }
        }),
        customization: {
          ...(isPdfDoc && serverEditorConfig?.customization),
          reviewDisplay: 'markup'
        },
        // The AI plugin of the editor would sit beside the assistant of
        // Twake, which writes in the document through the scribe
        ...(flag('cozy.assistant.enabled') && {
          plugins: { disable: [ONLYOFFICE_AI_PLUGIN] }
        })
      },
      token: onlyoffice.token,
      documentType: onlyoffice.documentType,
      events: {
        onAppReady: () => setIsEditorReady(true)
      }
    }

    // Derived from the validated URL, so the editor never sees the raw value
    // returned by the open route.
    setConfig({
      serverUrl: new URL(apiUrl).origin,
      apiUrl,
      docEditorConfig
    })
  }, [
    driveId,
    sharing,
    editorMode,
    queryResult,
    fetchStatus,
    data,
    config,
    setConfig,
    setIsEditorReady,
    isPublic,
    isReadOnly,
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
