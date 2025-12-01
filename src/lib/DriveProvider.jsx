import PropTypes from 'prop-types'
import React from 'react'

import { CozyProvider } from 'cozy-client'
import { DataProxyProvider } from 'cozy-dataproxy-lib'
import {
  VaultUnlockProvider,
  VaultProvider,
  VaultUnlockPlaceholder
} from 'cozy-keys-lib'
import SharingProvider, { NativeFileSharingProvider } from 'cozy-sharing'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { I18n } from 'cozy-ui/transpiled/react/providers/I18n'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import RightClickProvider from '@/components/RightClick/RightClickProvider'
import FabProvider from '@/lib/FabProvider'
import { DOCTYPE_APPS, DOCTYPE_CONTACTS, DOCTYPE_FILES } from '@/lib/doctypes'
import { usePublicContext } from '@/modules/public/PublicProvider'

const DriveProvider = ({ client, lang, polyglot, dictRequire, children }) => {
  const { isPublic } = usePublicContext()

  return (
    <I18n lang={lang} polyglot={polyglot} dictRequire={dictRequire}>
      <CozyProvider client={client}>
        <DataProxyWrapper isPublic={isPublic}>
          <VaultProvider cozyClient={client}>
            <VaultUnlockProvider>
              <SharingProvider doctype="io.cozy.files" documentType="Files">
                <NativeFileSharingProvider>
                  <CozyTheme ignoreCozySettings={isPublic} className="u-w-100">
                    <BreakpointsProvider>
                      <AlertProvider>
                        <VaultUnlockPlaceholder />
                        <FabProvider>
                          <RightClickProvider>{children}</RightClickProvider>
                        </FabProvider>
                      </AlertProvider>
                    </BreakpointsProvider>
                  </CozyTheme>
                </NativeFileSharingProvider>
              </SharingProvider>
            </VaultUnlockProvider>
          </VaultProvider>
        </DataProxyWrapper>
      </CozyProvider>
    </I18n>
  )
}

const DataProxyWrapper = ({ children, isPublic }) => {
  if (isPublic) {
    // Do not include DataProxy for public sharings
    return children
  }
  return (
    <DataProxyProvider
      options={{
        doctypes: [DOCTYPE_FILES, DOCTYPE_CONTACTS, DOCTYPE_APPS]
      }}
    >
      {children}
    </DataProxyProvider>
  )
}

DriveProvider.propTypes = {
  client: PropTypes.object.isRequired,
  lang: PropTypes.string.isRequired,
  polyglot: PropTypes.object,
  dictRequire: PropTypes.func
}

export default DriveProvider
