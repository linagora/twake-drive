import PropTypes from 'prop-types'
import React from 'react'

import { CozyProvider } from 'cozy-client'
import { DataProxyProvider } from 'cozy-dataproxy-lib'
import {
  VaultUnlockProvider,
  VaultProvider,
  VaultUnlockPlaceholder
} from 'cozy-keys-lib'
import SharingProvider, {
  NativeFileSharingProvider,
  SharingContext
} from 'cozy-sharing'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'
import { I18n } from 'twake-i18n'

import RightClickProvider from '@/components/RightClick/RightClickProvider'
import FabProvider from '@/lib/FabProvider'
import { DOCTYPE_APPS, DOCTYPE_CONTACTS, DOCTYPE_FILES } from '@/lib/doctypes'
import { usePublicContext } from '@/modules/public/PublicProvider'

/**
 * Minimal sharing context for public pages (accessed via sharecode).
 * On public pages, SharingProvider must not be used because its initialize()
 * method subscribes to io.cozy.sharings realtime events, which fails with a
 * 403 Forbidden error when using a read-only sharecode token.
 */
const PUBLIC_SHARING_CONTEXT = {
  byDocId: {},
  sharings: [],
  permissions: [],
  sharedFolderPaths: [],
  documentType: 'Files',
  isOwner: () => false,
  isSharedDrive: () => false,
  canReshare: () => false,
  getOwner: () => undefined,
  getSharingType: () => undefined,
  getSharingById: () => undefined,
  getSharingForSelf: () => undefined,
  getRecipients: () => [],
  getSharedParentPath: () => undefined,
  getDocumentPermissions: () => [],
  getSharingLink: () => null,
  hasSharedParent: () => false,
  hasSharedChild: () => false,
  share: async () => {},
  onShared: () => {},
  revoke: async () => {},
  revokeGroup: async () => {},
  revokeSelf: async () => {},
  shareByLink: async () => {},
  getFederatedShareLink: () => null,
  updateDocumentPermissions: async () => [],
  revokeSharingLink: async () => {},
  hasLoadedAtLeastOnePage: true,
  allLoaded: true,
  revokeAllRecipients: async () => {},
  refresh: () => {},
  hasWriteAccess: () => true, // defaults to true (no sharing restrictions found) since write access on public pages is controlled by isReadOnly and usePublicWritePermissions, matching the behavior of SharingProvider when byDocId is empty
  renameSharedDrive: async () => {},
  updateSharingMemberType: async () => {}
}

const SharingWrapper = ({ isPublic, children }) => {
  if (isPublic) {
    return (
      <SharingContext.Provider value={PUBLIC_SHARING_CONTEXT}>
        <NativeFileSharingProvider>{children}</NativeFileSharingProvider>
      </SharingContext.Provider>
    )
  }
  return (
    <SharingProvider doctype="io.cozy.files" documentType="Files">
      <NativeFileSharingProvider>{children}</NativeFileSharingProvider>
    </SharingProvider>
  )
}

const DriveProvider = ({ client, lang, polyglot, dictRequire, children }) => {
  const { isPublic } = usePublicContext()

  return (
    <I18n lang={lang} polyglot={polyglot} dictRequire={dictRequire}>
      <CozyProvider client={client}>
        <DataProxyWrapper isPublic={isPublic}>
          <VaultProvider cozyClient={client}>
            <VaultUnlockProvider>
              <SharingWrapper isPublic={isPublic}>
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
              </SharingWrapper>
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
