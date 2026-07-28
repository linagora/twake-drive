import PropTypes from 'prop-types'
import React from 'react'

import { CozyProvider } from 'cozy-client'
import SharingProvider from 'cozy-sharing'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'
import { I18n } from 'twake-i18n'

import { usePublicContext } from '@/modules/public/PublicProvider'

const IntentProvider = ({ client, lang, polyglot, dictRequire, children }) => {
  const { isPublic } = usePublicContext()

  return (
    <I18n lang={lang} polyglot={polyglot} dictRequire={dictRequire}>
      <CozyProvider client={client}>
        <SharingProvider
          doctype="io.cozy.files"
          documentType="Files"
          isPublic={isPublic}
        >
          <CozyTheme ignoreCozySettings={isPublic} className="u-w-100">
            <BreakpointsProvider>
              <AlertProvider>{children}</AlertProvider>
            </BreakpointsProvider>
          </CozyTheme>
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
