import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useNavigate } from 'react-router-dom'

import { BarComponent } from 'cozy-bar'
import CozyDevtools from 'cozy-devtools'
import flag from 'cozy-flags'
import FlagSwitcher from 'cozy-flags/dist/FlagSwitcher'
import Sprite from 'cozy-ui/transpiled/react/Icon/Sprite'
import { Layout as LayoutUI } from 'cozy-ui/transpiled/react/Layout'
import Sidebar from 'cozy-ui/transpiled/react/Sidebar'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Storage from 'cozy-ui-plus/dist/Storage'
import { useI18n } from 'twake-i18n'

import FilesRealTimeQueries from '@/components/FilesRealTimeQueries'
import Drive from '@/components/Icons/Drive'
import DriveText from '@/components/Icons/DriveText'
import ButtonClient from '@/components/pushClient/Button'
import { ROOT_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import useCurrentFolderWriteAccess from '@/hooks/useCurrentFolderWriteAccess'
import { initFlags } from '@/lib/flags'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import AddButton from '@/modules/drive/Toolbar/components/AddButton'
import Nav from '@/modules/navigation/Nav'
import { NavProvider, useNavContext } from '@/modules/navigation/NavContext'
import {
  wasOperationRedirected,
  RESET_OPERATION_REDIRECTED
} from '@/modules/navigation/duck/reducer'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'
import { NewItemHighlightProvider } from '@/modules/upload/NewItemHighlightProvider'
import UploadButton from '@/modules/upload/UploadButton'
import UploadQueue from '@/modules/upload/UploadQueue'

initFlags()

const LayoutContent = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { isMobile, isDesktop } = useBreakpoints()
  const { displayedFolder } = useDisplayedFolder()
  const { t } = useI18n()

  const shouldRedirect = useSelector(wasOperationRedirected)
  const [, setLastClicked] = useNavContext()

  useEffect(() => {
    if (shouldRedirect) {
      // Update lastClicked state to ensure sidebar shows the correct active item
      setLastClicked(`/folder/${ROOT_DIR_ID}`)
      navigate(`/folder/${ROOT_DIR_ID}`)
      dispatch({ type: RESET_OPERATION_REDIRECTED })
    }
  }, [shouldRedirect, navigate, dispatch, setLastClicked])

  const canWriteToCurrentFolder = useCurrentFolderWriteAccess()

  return (
    <LayoutUI onContextMenu={ev => ev.preventDefault()}>
      <NewItemHighlightProvider>
        <BarComponent
          searchOptions={{ enabled: !isMobile }}
          disableInternalStore
          appIcon={Drive}
          appTextIcon={DriveText}
        />
        <FlagSwitcher />
        <Sidebar className="u-flex-justify-between">
          <div>
            {isDesktop && canWriteToCurrentFolder ? (
              <div className="u-mh-1 u-mt-half">
                <AddMenuProvider
                  canCreateFolder={true}
                  canUpload={true}
                  disabled={false}
                  displayedFolder={displayedFolder}
                  isSelectionBarVisible={false}
                  componentsProps={{ AddMenu: { isUploadDisabled: true } }}
                >
                  <AddButton className="u-w-100 u-bdrs-6 u-mt-half u-mb-half u-fz-small" />
                </AddMenuProvider>
                <UploadButton
                  componentsProps={{
                    button: { className: 'u-w-100 u-bdrs-6 u-fz-small' }
                  }}
                  label={t('upload.label')}
                  displayedFolder={displayedFolder}
                />
              </div>
            ) : null}
            <Nav />
          </div>
          {isDesktop && (
            <div>
              <div className="u-p-1-half">
                <Storage />
              </div>
              <ButtonClient />
            </div>
          )}
        </Sidebar>
        <UploadQueue />
        {/* Mounted once here so every route (folders and editors) keeps the
            io.cozy.files store in sync with server-side changes. */}
        <FilesRealTimeQueries />
        <SelectionProvider>
          <Outlet />
        </SelectionProvider>
        <Sprite />
        {flag('debug') && <CozyDevtools />}
      </NewItemHighlightProvider>
    </LayoutUI>
  )
}

const Layout = () => {
  return (
    <NavProvider>
      <LayoutContent />
    </NavProvider>
  )
}

export default Layout
