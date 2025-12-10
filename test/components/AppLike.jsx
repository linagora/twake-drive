import React, { Fragment } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { createStore } from 'redux'
import { I18n } from 'twake-i18n'

import { CozyProvider } from 'cozy-client'
import flag from 'cozy-flags'
import { SharingContext, NativeFileSharingProvider } from 'cozy-sharing'
import { Layout } from 'cozy-ui/transpiled/react/Layout'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import PushBannerProvider from '@/components/PushBanner/PushBannerProvider'
import RightClickProvider from '@/components/RightClick/RightClickProvider'
import ClipboardProvider from '@/contexts/ClipboardProvider'
import { AcceptingSharingProvider } from '@/lib/AcceptingSharingContext'
import FabProvider from '@/lib/FabProvider'
import { ModalContext } from '@/lib/ModalContext'
import { ViewSwitcherContextProvider } from '@/lib/ViewSwitcherContext'
import enLocale from '@/locales/en.json'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'
import { NewItemHighlightProvider } from '@/modules/upload/NewItemHighlightProvider'

const mockStore = createStore(() => ({
  mobile: {
    url: 'cozy-url://'
  }
}))

export const TestI18n = ({ children }) => {
  return (
    <I18n lang="en" dictRequire={() => enLocale}>
      {children}
    </I18n>
  )
}

const mockSharingContextValue = {
  refresh: jest.fn(),
  hasWriteAccess: jest.fn(),
  getRecipients: jest.fn().mockReturnValue([]),
  getDocumentPermissions: jest.fn(),
  isOwner: jest.fn(),
  allLoaded: jest.fn(),
  hasSharedParent: jest.fn(),
  getSharingLink: jest.fn()
}

const mockModalContextValue = {
  pushModal: jest.fn(),
  modalStack: []
}

const NewItemHighlightProviderWrapper = flag(
  'drive.highlight-new-items.enabled'
)
  ? NewItemHighlightProvider
  : Fragment

const AppLike = ({
  children,
  store,
  client,
  sharingContextValue,
  modalContextValue
}) => (
  <CozyTheme>
    <Provider store={store || (client && client.store) || mockStore}>
      <CozyProvider client={client}>
        <TestI18n>
          <SharingContext.Provider
            value={sharingContextValue || mockSharingContextValue}
          >
            <AcceptingSharingProvider>
              <NativeFileSharingProvider>
                <HashRouter>
                  <NewItemHighlightProviderWrapper>
                    <SelectionProvider>
                      <ViewSwitcherContextProvider>
                        <BreakpointsProvider>
                          <AlertProvider>
                            <PushBannerProvider>
                              <ClipboardProvider>
                                <ModalContext.Provider
                                  value={
                                    modalContextValue || mockModalContextValue
                                  }
                                >
                                  <DndProvider backend={HTML5Backend}>
                                    <FabProvider>
                                      <RightClickProvider>
                                        <Layout>{children}</Layout>
                                      </RightClickProvider>
                                    </FabProvider>
                                  </DndProvider>
                                </ModalContext.Provider>
                              </ClipboardProvider>
                            </PushBannerProvider>
                          </AlertProvider>
                        </BreakpointsProvider>
                      </ViewSwitcherContextProvider>
                    </SelectionProvider>
                  </NewItemHighlightProviderWrapper>
                </HashRouter>
              </NativeFileSharingProvider>
            </AcceptingSharingProvider>
          </SharingContext.Provider>
        </TestI18n>
      </CozyProvider>
    </Provider>
  </CozyTheme>
)

export default AppLike
