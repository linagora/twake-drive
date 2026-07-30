import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useClient } from 'cozy-client'
import Intents from 'cozy-interapp'
import logger from 'cozy-logger'
import Box from 'cozy-ui/transpiled/react/Box'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import { getFilePickerConfig } from './FilePicker/config'
import { buildContentFolderQuery } from './FilePicker/queries'
import Picker from './Picker'

import { ROOT_DIR_ID } from '@/constants/config'
function isFilePickerIntent(intent) {
  return (
    intent?.attributes?.action === 'PICK' &&
    intent?.attributes?.type === 'io.cozy.files'
  )
}

async function initPicker(client) {
  const rootFolderQuery = buildContentFolderQuery(ROOT_DIR_ID)

  try {
    await client.query(rootFolderQuery.definition(), rootFolderQuery.options)
  } catch (error) {
    logger.warn('File Picker root prefetch failed', error)
  }

  return Picker
}

const IntentHandler = ({ intentId }) => {
  const client = useClient()

  const [state, setState] = useState({
    component: null,
    service: null,
    intent: null
  })

  const ServiceComponent = state.component
  const hasNotifiedReadyRef = useRef(false)

  const handleReadyToUse = useCallback(() => {
    if (hasNotifiedReadyRef.current) return
    hasNotifiedReadyRef.current = true
    state.service?.notifyReadyToUse()
  }, [state.service])

  useEffect(() => {
    const startService = async () => {
      let service
      try {
        const intents = new Intents({ client })
        // createService exposes the intent only after the handshake, so fetch it separately to start prefetching earlier
        const intentPromise = intents.request.get(intentId, { tryDOM: true })
        const servicePromise = intents.createService(intentId, window)
        const pendingIntent = await intentPromise
        setState(currentState => ({
          ...currentState,
          intent: pendingIntent
        }))
        const pickerInitialization = isFilePickerIntent(pendingIntent)
          ? initPicker(client)
          : null

        service = await servicePromise
        const intent = service.getIntent()
        const component = await pickerInitialization

        setState({
          component,
          service,
          intent
        })
      } catch (error) {
        logger.error(error)
        service.throw(error)
      }
    }

    startService()
  }, [client, intentId])

  const content = ServiceComponent ? (
    <ServiceComponent
      service={state.service}
      intent={state.intent}
      onReadyToUse={handleReadyToUse}
    />
  ) : (
    <Box className="u-h-100 u-w-100" bgcolor="background.paper" />
  )

  if (!isFilePickerIntent(state.intent)) return content

  const serviceData = state.service?.getData?.()
  const { type: themeType } = getFilePickerConfig(
    state.intent,
    serviceData
  ).theme

  return (
    <CozyTheme
      className="u-h-100 u-w-100"
      type={themeType}
      ignoreCozySettings
      ignoreItself={false}
    >
      <BreakpointsProvider>
        <AlertProvider>{content}</AlertProvider>
      </BreakpointsProvider>
    </CozyTheme>
  )
}

export default IntentHandler
