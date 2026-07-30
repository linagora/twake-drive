import PropTypes from 'prop-types'
import React from 'react'

import { CozyProvider } from 'cozy-client'
import SharingProvider from 'cozy-sharing'
import { I18n } from 'twake-i18n'

const IntentProvider = ({ client, lang, polyglot, dictRequire, children }) => {
  return (
    <I18n lang={lang} polyglot={polyglot} dictRequire={dictRequire}>
      <CozyProvider client={client}>
        <SharingProvider doctype="io.cozy.files" documentType="Files">
          {children}
        </SharingProvider>
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
