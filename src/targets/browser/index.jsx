/* eslint-disable import/order */

// cozy-ui css import should be done before any other import
// otherwise the themes will not be supplied and the app crashes
import 'cozy-ui/transpiled/react/stylesheet.css'
import 'cozy-ui/dist/cozy-ui.utils.min.css'
import 'cozy-ui-plus/dist/stylesheet.css'
import 'cozy-viewer/dist/stylesheet.css'
import 'cozy-bar/dist/stylesheet.css'
import 'cozy-sharing/dist/stylesheet.css'

// Uncomment to activate why-did-you-render
// https://github.com/welldone-software/why-did-you-render
// import './wdyr'

import 'whatwg-fetch'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

import setupApp from './setupAppContext'
import App from '@/components/App/App'
import AppRoute from '@/modules/navigation/AppRoute'

// ambient styles
import styles from '@/styles/main.styl' // eslint-disable-line no-unused-vars

const AppComponent = props => (
  <App {...props}>
    <HashRouter>
      <AppRoute />
    </HashRouter>
  </App>
)

const init = () => {
  const { locale, polyglot, client, store, root } = setupApp()

  createRoot(root).render(
    <AppComponent
      lang={locale}
      polyglot={polyglot}
      client={client}
      store={store}
    />
  )
}
document.addEventListener('DOMContentLoaded', () => {
  init()
})
