import React, { useEffect, useState } from 'react'

import { useClient } from 'cozy-client'
import Intents from 'cozy-interapp'
import logger from 'cozy-logger'
import Box from 'cozy-ui/transpiled/react/Box'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import { getFilePickerConfig } from './FilePicker/config'
import { initializeFilePicker } from './FilePicker/initialization'
import Picker from './Picker'

function isFilePickerIntent(intent) {
  return (
    intent?.attributes?.action === 'PICK' &&
    intent?.attributes?.type === 'io.cozy.files'
  )
}

const IntentHandler = ({ intentId }) => {
  const client = useClient()

  // Show the intent's loading theme until handshake and folder resolution finish.
  const [state, setState] = useState({
    component: null,
    service: null,
    intent: null,
    filePickerConfig: null
  })

  const ServiceComponent = state.component
  const handleReadyToUse = () => state.service?.notifyReadyToUse()

  // The iframe handshake is external I/O, started after mount for this intent.
  useEffect(() => {
    const startService = async () => {
      let service
      try {
        const intents = new Intents({ client })
        // The intent is available before the handshake, allowing the loading surface to use its theme.
        const intentPromise = intents.request.get(intentId, { tryDOM: true })
        const servicePromise = intents.createService(intentId, window)
        const pendingIntent = await intentPromise
        setState(currentState => ({
          ...currentState,
          intent: pendingIntent
        }))
        service = await servicePromise
        const intent = service.getIntent()
        const filePickerConfig = isFilePickerIntent(intent)
          ? await initializeFilePicker(
              client,
              getFilePickerConfig(intent, service.getData?.())
            )
          : null

        setState({
          component: filePickerConfig ? Picker : null,
          service,
          intent,
          filePickerConfig
        })
      } catch (error) {
        logger.error(error)
        service?.throw(new Error(error?.message || String(error)))
      }
    }

    startService()
  }, [client, intentId])

  const content = ServiceComponent ? (
    <ServiceComponent
      service={state.service}
      intent={state.intent}
      filePickerConfig={state.filePickerConfig}
      onReadyToUse={handleReadyToUse}
    />
  ) : (
    <Box className="u-h-100 u-w-100" bgcolor="background.paper" />
  )

  if (!isFilePickerIntent(state.intent)) return content

  const serviceData = state.service?.getData?.()
  const { type: themeType } = (
    state.filePickerConfig || getFilePickerConfig(state.intent, serviceData)
  ).theme

  return (
    <CozyTheme
      className="u-h-100 u-w-100"
      type={themeType}
      ignoreItself={false}
    >
      <BreakpointsProvider parentBasedIframe>
        <AlertProvider>{content}</AlertProvider>
      </BreakpointsProvider>
    </CozyTheme>
  )
}

export default IntentHandler
