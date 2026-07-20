import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useClient } from 'cozy-client'
import Intents from 'cozy-interapp'
import logger from 'cozy-logger'

import { buildContentFolderQuery } from './FilePicker/queries'
import Picker from './Picker'

import { ROOT_DIR_ID } from '@/constants/config'

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
        const intentPromise = intents.request.get(intentId)
        const servicePromise = intents.createService(intentId, window)
        const pendingIntent = await intentPromise
        const pickerInitialization =
          pendingIntent.attributes.action === 'PICK' &&
          pendingIntent.attributes.type === 'io.cozy.files'
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

  return ServiceComponent ? (
    <ServiceComponent
      service={state.service}
      intent={state.intent}
      onReadyToUse={handleReadyToUse}
    />
  ) : (
    <div className="u-w-100 u-bg-charcoalGrey" />
  )
}

export default IntentHandler
