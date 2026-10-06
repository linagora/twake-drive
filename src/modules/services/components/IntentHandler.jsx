import React, { useCallback, useEffect, useState } from 'react'

import { useClient } from 'cozy-client'
import Intents from 'cozy-interapp'
import logger from 'cozy-logger'
import Box from 'cozy-ui/transpiled/react/Box'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import { getFilePickerConfig } from './FilePicker/config'
import { MoveIntent } from './MoveIntent'
import {
  getMoveIntentConfig,
  initializeMoveIntent
} from './MoveIntent/initialization'
import Picker from './Picker'
import { Upload } from './Upload'
import { getIntentData, getPickerNavigationConfig } from './intentConfig'
import { initializePickerNavigation } from './pickerNavigation'

function isFileNavigationIntent(intent) {
  return (
    ['PICK', 'MOVE'].includes(intent?.attributes?.action) &&
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
    pickerConfig: null
  })

  const ServiceComponent = state.component
  const handleReadyToUse = useCallback(
    () => state.service?.notifyReadyToUse(),
    [state.service]
  )

  // The iframe handshake is external I/O, started after mount for this intent.
  useEffect(() => {
    // A late handshake must not start an upload for a replaced or unmounted intent.
    let isActive = true
    const startService = async () => {
      let service
      try {
        const intents = new Intents({ client })
        // The intent is available before the handshake, allowing the loading surface to use its theme.
        const intentPromise = intents.request.get(intentId, { tryDOM: true })
        const servicePromise = intents.createService(intentId, window)
        const pendingIntent = await intentPromise
        if (isActive) {
          setState(currentState => ({
            ...currentState,
            intent: pendingIntent
          }))
        }
        service = await servicePromise
        if (!isActive) return
        const intent = service.getIntent()
        const isUploadIntent =
          intent?.attributes?.action === 'UPLOAD' &&
          intent?.attributes?.type === 'io.cozy.files'
        let component = isUploadIntent ? Upload : null
        let pickerConfig = null
        if (isFileNavigationIntent(intent)) {
          const serviceData = service.getData?.()
          const isMove = intent.attributes.action === 'MOVE'
          pickerConfig = isMove
            ? await initializeMoveIntent(
                client,
                getMoveIntentConfig(intent, serviceData)
              )
            : await initializePickerNavigation(
                client,
                getFilePickerConfig(intent, serviceData)
              )
          component = isMove ? MoveIntent : Picker
        }
        if (!isActive) return

        setState({ component, service, intent, pickerConfig })
      } catch (error) {
        if (!isActive) return
        logger.error(error)
        service?.throw(new Error(error?.message || String(error)))
      }
    }

    startService()
    return () => {
      isActive = false
    }
  }, [client, intentId])

  const content = ServiceComponent ? (
    <ServiceComponent
      service={state.service}
      intent={state.intent}
      filePickerConfig={state.pickerConfig}
      moveIntentConfig={state.pickerConfig}
      onReadyToUse={handleReadyToUse}
    />
  ) : (
    <Box className="u-h-100 u-w-100" bgcolor="background.paper" />
  )

  if (!isFileNavigationIntent(state.intent)) return content

  const serviceData = state.service?.getData?.()
  const { type: themeType } = (
    state.pickerConfig ||
    getPickerNavigationConfig(
      getIntentData(state.intent, serviceData) || {},
      []
    )
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
