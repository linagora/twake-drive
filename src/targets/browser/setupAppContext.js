import memoize from 'lodash/memoize'

import CozyClient, { DataProxyLink, StackLink } from 'cozy-client'
import { Document } from 'cozy-doctypes'
import flag from 'cozy-flags'
import { initTranslation } from 'twake-i18n'

import appMetadata from '@/lib/appMetadata'
import { schema } from '@/lib/doctypes'
import registerClientPlugins from '@/lib/registerClientPlugins'
import configureStore from '@/store/configureStore'

const setupApp = memoize(() => {
  const root = document.querySelector('[role=application]')
  const data = JSON.parse(root.dataset.cozy)

  const protocol = window.location ? window.location.protocol : 'https:'
  const cozyUrl = `${protocol}//${data.domain}`

  const platform = {
    isOnline: () => window?.navigator?.onLine
  }

  const links = [new StackLink({ platform })]
  // cozy-flags is not guaranteed to be populated this early, so the DataProxy
  // link would be dropped on first load; read the flag from the injected data
  // blob (always present synchronously) with a cozy-flags fallback.
  const dataproxyQueriesEnabled =
    data.flags?.['dataproxy.queries.enabled'] ??
    flag('dataproxy.queries.enabled')
  if (dataproxyQueriesEnabled) {
    // DataProxy link will be used for offline data queries
    const dataproxyLink = new DataProxyLink()
    links.push(dataproxyLink)
  }

  const client = new CozyClient({
    uri: cozyUrl,
    token: data.token,
    appMetadata,
    schema,
    useCustomStore: true,
    links
  })

  if (!Document.cozyClient) {
    Document.registerClient(client)
  }
  const locale = data.locale
  registerClientPlugins(client)
  const polyglot = initTranslation(locale, lang => require(`@/locales/${lang}`))

  const store = configureStore({
    client,
    t: polyglot.t.bind(polyglot)
  })

  return { locale, polyglot, client, store, root }
})

export default setupApp
