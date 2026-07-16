import React from 'react'
import { Outlet } from 'react-router-dom'

import { BarComponent } from 'cozy-bar'
import FlagSwitcher from 'cozy-flags/dist/FlagSwitcher'
import { Layout } from 'cozy-ui/transpiled/react/Layout'

import FilesRealTimeQueries from '@/components/FilesRealTimeQueries'
import Drive from '@/components/Icons/Drive'
import DriveText from '@/components/Icons/DriveText'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'
import { NewItemHighlightProvider } from '@/modules/upload/NewItemHighlightProvider'
import UploadQueue from '@/modules/upload/UploadQueue'

const PublicLayout = () => {
  return (
    <Layout>
      <BarComponent
        replaceTitleOnMobile
        isPublic
        disableInternalStore
        appIcon={Drive}
        appTextIcon={DriveText}
      />
      <FlagSwitcher />
      <UploadQueue />
      {/* Mounted once here so every public route (folders and editors) keeps
          the io.cozy.files store in sync with server-side changes. */}
      <FilesRealTimeQueries />
      <NewItemHighlightProvider>
        <SelectionProvider>
          <Outlet />
        </SelectionProvider>
      </NewItemHighlightProvider>
    </Layout>
  )
}

export default PublicLayout
