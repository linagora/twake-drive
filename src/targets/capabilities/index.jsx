/* eslint-disable import/order */

import 'cozy-ui/transpiled/react/stylesheet.css'
import 'cozy-ui/dist/cozy-ui.utils.min.css'

import 'whatwg-fetch'
import React from 'react'
import { createRoot } from 'react-dom/client'

import CozyClient from 'cozy-client'

import DriveProvider from '@/lib/DriveProvider'
import appMetadata from '@/lib/appMetadata'
import { schema } from '@/lib/doctypes'
import registerClientPlugins from '@/lib/registerClientPlugins'
import { CapabilityRouter, parseParams } from '@/modules/openBuro'

// ambient styles
import styles from '@/styles/main.styl' // eslint-disable-line no-unused-vars

const extractAction = pathname => {
  const match = pathname.match(/\/capabilities\/([^/?#]+)/)
  return match ? match[1] : null
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('main')
  const data = JSON.parse(root.dataset.cozy)

  const protocol = window.location ? window.location.protocol : 'https:'
  const cozyUrl = `${protocol}//${data.domain}`

  const action = extractAction(window.location.pathname)
  const params = parseParams(window.location.search)

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
      <CapabilityRouter action={action} params={params} />
    </DriveProvider>
  )
})
