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
import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { useDisplayedFolder } from '@/hooks'
import useCurrentFolderId from '@/hooks/useCurrentFolderId'
import useCurrentFolderWriteAccess from '@/hooks/useCurrentFolderWriteAccess'
import { initFlags } from '@/lib/flags'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import AddButton from '@/modules/drive/Toolbar/components/AddButton'
import Nav from '@/modules/navigation/Nav'
import { NavProvider, useNavContext } from '@/modules/navigation/NavContext'
import FilePickerButton from '@/modules/navigation/components/FilePickerButton'
import {
  wasOperationRedirected,
  RESET_OPERATION_REDIRECTED
} from '@/modules/navigation/duck/reducer'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'
import { NewItemHighlightProvider } from '@/modules/upload/NewItemHighlightProvider'
import UploadButton from '@/modules/upload/UploadButton'
import UploadQueue from '@/modules/upload/UploadQueue'

initFlags()

// Flag consumed by AddFolder when it mounts on root after a no-folder navigation.
let pendingCreateOnRoot = false

export const consumeCreateOnRoot = () => {
  if (pendingCreateOnRoot) {
    pendingCreateOnRoot = false
    return true
  }
  return false
}

const LayoutContent = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { isMobile, isDesktop } = useBreakpoints()
  const { displayedFolder } = useDisplayedFolder()
  const { t } = useI18n()
  const rawFolderId = useCurrentFolderId()

  const shouldRedirect = useSelector(wasOperationRedirected)
  const [, setLastClicked] = useNavContext()

  useEffect(() => {
    if (shouldRedirect) {
      setLastClicked(`/folder/${ROOT_DIR_ID}`)
      navigate(`/folder/${ROOT_DIR_ID}`)
      dispatch({ type: RESET_OPERATION_REDIRECTED })
    }
  }, [shouldRedirect, navigate, dispatch, setLastClicked])

  const canWriteToCurrentFolder = useCurrentFolderWriteAccess()

  const isNoFolderSection = rawFolderId === null || rawFolderId === TRASH_DIR_ID
  const isReadOnly = !isNoFolderSection && !canWriteToCurrentFolder

  const goToRoot = ({ create } = {}) => {
    if (create) pendingCreateOnRoot = true
    setLastClicked(`/folder/${ROOT_DIR_ID}`)
    navigate(`/folder/${ROOT_DIR_ID}`)
  }

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
            {isDesktop && isNoFolderSection ? (
              <div className="u-mh-1 u-mt-half">
                <AddMenuProvider
                  canCreateFolder={true}
                  canUpload={true}
                  disabled={false}
                  displayedFolder={displayedFolder}
                  isSelectionBarVisible={false}
                  componentsProps={{ AddMenu: { isUploadDisabled: true } }}
                  onAddFolder={() => goToRoot({ create: true })}
                >
                  <AddButton className="u-w-100 u-bdrs-6 u-mt-half u-mb-half u-fz-small" />
                </AddMenuProvider>
                <UploadButton
                  folderId={null}
                  onUploadStart={() => goToRoot()}
                  componentsProps={{
                    button: {
                      className: 'u-w-100 u-bdrs-6 u-fz-small'
                    }
                  }}
                  label={t('upload.label')}
                  displayedFolder={displayedFolder}
                />
              </div>
            ) : isDesktop ? (
              <div className="u-mh-1 u-mt-half">
                <AddMenuProvider
                  canCreateFolder={true}
                  canUpload={true}
                  disabled={isReadOnly}
                  displayedFolder={displayedFolder}
                  isSelectionBarVisible={false}
                  componentsProps={{ AddMenu: { isUploadDisabled: true } }}
                >
                  <AddButton className="u-w-100 u-bdrs-6 u-mt-half u-mb-half u-fz-small" />
                </AddMenuProvider>
                <UploadButton
                  disabled={isReadOnly}
                  componentsProps={{
                    button: {
                      className: 'u-w-100 u-bdrs-6 u-fz-small',
                      disabled: isReadOnly
                    }
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
              {flag('drive.file-picker-demo.enabled') && <FilePickerButton />}
              <div className="u-p-1-half">
                <Storage />
              </div>
              <ButtonClient />
            </div>
          )}
        </Sidebar>
        <UploadQueue />
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
