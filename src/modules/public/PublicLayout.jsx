import React from 'react'
import { Outlet } from 'react-router-dom'

import { BarComponent } from 'cozy-bar'
import FlagSwitcher from 'cozy-flags/dist/FlagSwitcher'
import Sprite from 'cozy-ui/transpiled/react/Icon/Sprite'
import { Layout } from 'cozy-ui/transpiled/react/Layout'

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
      <NewItemHighlightProvider>
        <SelectionProvider>
          <Outlet />
        </SelectionProvider>
      </NewItemHighlightProvider>
      <Sprite />
    </Layout>
  )
}

export default PublicLayout
