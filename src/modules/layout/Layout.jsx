import React, { Fragment, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { BarComponent } from 'cozy-bar'
import CozyDevtools from 'cozy-devtools'
import flag from 'cozy-flags'
import FlagSwitcher from 'cozy-flags/dist/FlagSwitcher'
import { useSharingContext } from 'cozy-sharing'
import Sprite from 'cozy-ui/transpiled/react/Icon/Sprite'
import { Layout as LayoutUI } from 'cozy-ui/transpiled/react/Layout'
import Sidebar from 'cozy-ui/transpiled/react/Sidebar'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Storage from 'cozy-ui-plus/dist/Storage'

import ButtonClient from '@/components/pushClient/Button'
import { ROOT_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
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
  const { hasWriteAccess } = useSharingContext()
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

  const isFolderReadOnly = displayedFolder
    ? !hasWriteAccess(displayedFolder._id, displayedFolder.driveId)
    : false

  const NewItemHighlightProviderWrapper = flag(
    'drive.highlight-new-items.enabled'
  )
    ? NewItemHighlightProvider
    : Fragment

  return (
    <LayoutUI onContextMenu={ev => ev.preventDefault()}>
      <NewItemHighlightProviderWrapper>
        <BarComponent
          searchOptions={{ enabled: !isMobile }}
          disableInternalStore
        />
        <FlagSwitcher />
        <Sidebar className="u-flex-justify-between">
          <div>
            {isDesktop ? (
              <div className="u-mh-1-half u-mt-1-half">
                <UploadButton
                  componentsProps={{
                    button: { className: 'u-w-100 u-bdrs-6' }
                  }}
                  label={t('upload.label')}
                  displayedFolder={displayedFolder}
                  disabled={isFolderReadOnly}
                />
                <AddMenuProvider
                  canCreateFolder={true}
                  canUpload={!isFolderReadOnly}
                  disabled={false}
                  displayedFolder={displayedFolder}
                  isSelectionBarVisible={false}
                  isReadOnly={isFolderReadOnly}
                  componentsProps={{ AddMenu: { isUploadDisabled: true } }}
                >
                  <AddButton className="u-w-100 u-bdrs-6 u-mt-half" />
                </AddMenuProvider>
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
        <SelectionProvider>
          <Outlet />
        </SelectionProvider>
        <Sprite />
        {flag('debug') && <CozyDevtools />}
      </NewItemHighlightProviderWrapper>
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
