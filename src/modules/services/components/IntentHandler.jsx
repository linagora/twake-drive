import React, { useEffect, useState } from 'react'

import { useClient } from 'cozy-client'
import Intents from 'cozy-interapp'
import logger from 'cozy-logger'

import { buildContentFolderQuery } from './FilePicker/queries'
import Picker from './Picker'

import { ROOT_DIR_ID } from '@/constants/config'

const IntentHandler = ({ intentId }) => {
  const client = useClient()

  const [state, setState] = useState({
    component: null,
    service: null,
    intent: null
  })

  const ServiceComponent = state.component

  useEffect(() => {
    const startService = async () => {
      let component
      let service
      let intent
      try {
        const intents = new Intents({ client })
        const intentPromise = intents.request.get(intentId)
        const servicePromise = intents.createService(intentId, window)
        const pendingIntent = await intentPromise
        let rootFolderPrefetch = null

        if (
          pendingIntent.attributes.action === 'PICK' &&
          pendingIntent.attributes.type === 'io.cozy.files'
        ) {
          component = Picker
          const rootFolderQuery = buildContentFolderQuery(ROOT_DIR_ID)
          rootFolderPrefetch = client
            .query(rootFolderQuery.definition(), rootFolderQuery.options)
            .catch(error => {
              logger.warn('File Picker root prefetch failed', error)
              return null
            })
        }

        service = await servicePromise
        intent = service.getIntent()
        await rootFolderPrefetch

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
    <ServiceComponent service={state.service} intent={state.intent} />
  ) : (
    <div className="u-w-100 u-bg-charcoalGrey" />
  )
}

export default IntentHandler
