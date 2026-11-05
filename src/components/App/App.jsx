import PropTypes from 'prop-types'
import React, { Fragment } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Provider } from 'react-redux'

import { BarProvider } from 'cozy-bar'
import flag from 'cozy-flags'
import { WebviewIntentProvider } from 'cozy-intent'

import MoveValidationModals from '@/components/MoveValidationModals'
import PushBannerProvider from '@/components/PushBanner/PushBannerProvider'
import ClipboardProvider from '@/contexts/ClipboardProvider'
import { AcceptingSharingProvider } from '@/lib/AcceptingSharingContext'
import DriveProvider from '@/lib/DriveProvider'
import { ModalContextProvider } from '@/lib/ModalContext'
import { ViewSwitcherContextProvider } from '@/lib/ViewSwitcherContext'
import { PublicProvider } from '@/modules/public/PublicProvider'
import { onFileUploaded } from '@/modules/views/Upload/UploadUtils'

const Providers = ({ children }) => {
  const [DnDProvider, dnDProviderProps] = flag('drive.virtualization.enabled')
    ? [DndProvider, { backend: HTML5Backend }]
    : [Fragment, {}]

  return (
    <BarProvider>
      <PushBannerProvider>
        <ClipboardProvider>
          <AcceptingSharingProvider>
            <ViewSwitcherContextProvider>
              <ModalContextProvider>
                <DnDProvider {...dnDProviderProps}>
                  {children}
                  <MoveValidationModals />
                </DnDProvider>
              </ModalContextProvider>
            </ViewSwitcherContextProvider>
          </AcceptingSharingProvider>
        </ClipboardProvider>
      </PushBannerProvider>
    </BarProvider>
  )
}

const App = ({ isPublic, store, client, lang, polyglot, children }) => {
  return (
    <WebviewIntentProvider
      methods={{
        onFileUploaded: (file, isSuccess) =>
          onFileUploaded({ file, isSuccess }, store.dispatch)
      }}
    >
      <PublicProvider isPublic={isPublic}>
        <Provider store={store}>
          <DriveProvider client={client} lang={lang} polyglot={polyglot}>
            <Providers>{children}</Providers>
          </DriveProvider>
        </Provider>
      </PublicProvider>
    </WebviewIntentProvider>
  )
}

App.propTypes = {
  store: PropTypes.object,
  lang: PropTypes.string,
  polyglot: PropTypes.object,
  client: PropTypes.object
}
export default App
