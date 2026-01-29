/* eslint-disable import/order */

import 'cozy-ui/transpiled/react/stylesheet.css'
import 'cozy-ui/dist/cozy-ui.utils.min.css'
import 'cozy-viewer/dist/stylesheet.css'
import 'cozy-sharing/dist/stylesheet.css'

import 'whatwg-fetch'
import React from 'react'
import { getQueryParameter } from '@/lib/react-cozy-helpers'
import { createRoot } from 'react-dom/client'

import CozyClient from 'cozy-client'

import DriveProvider from '@/lib/DriveProvider'
import appMetadata from '@/lib/appMetadata'
import { schema } from '@/lib/doctypes'
import registerClientPlugins from '@/lib/registerClientPlugins'
import IntentHandler from '@/modules/services'

// ambient styles
import styles from '@/styles/main.styl' // eslint-disable-line no-unused-vars

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('main')
  const data = JSON.parse(root.dataset.cozy)

  const protocol = window.location ? window.location.protocol : 'https:'
  const cozyUrl = `${protocol}//${data.domain}`

  const { intent } = getQueryParameter()

  const client = new CozyClient({
    uri: cozyUrl,
    token: data.token,
    appMetadata,
    schema
  })

  registerClientPlugins(client)

  createRoot(root).render(
    <DriveProvider
      client={client}
      lang={data.locale}
      dictRequire={lang => require(`@/locales/${lang}`)}
    >
      <IntentHandler intentId={intent} />
    </DriveProvider>
  )
})
