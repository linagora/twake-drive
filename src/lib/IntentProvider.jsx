import PropTypes from 'prop-types'
import React from 'react'

import { CozyProvider } from 'cozy-client'
import { DataProxyProvider } from 'cozy-dataproxy-lib'
import SharingProvider from 'cozy-sharing'
import { I18n } from 'twake-i18n'

import { DOCTYPE_APPS, DOCTYPE_CONTACTS, DOCTYPE_FILES } from '@/lib/doctypes'

const IntentProvider = ({ client, lang, polyglot, dictRequire, children }) => {
  return (
    <I18n lang={lang} polyglot={polyglot} dictRequire={dictRequire}>
      <CozyProvider client={client}>
        <DataProxyProvider
          options={{
            doctypes: [DOCTYPE_FILES, DOCTYPE_CONTACTS, DOCTYPE_APPS]
          }}
        >
          <SharingProvider doctype="io.cozy.files" documentType="Files">
            {children}
          </SharingProvider>
        </DataProxyProvider>
      </CozyProvider>
    </I18n>
  )
}

IntentProvider.propTypes = {
  client: PropTypes.object.isRequired,
  lang: PropTypes.string.isRequired,
  polyglot: PropTypes.object,
  dictRequire: PropTypes.func
}

export default IntentProvider
