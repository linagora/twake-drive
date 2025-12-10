import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  createContext
} from 'react'
import { useI18n } from 'twake-i18n'

import useBrowserOffline from 'cozy-ui/transpiled/react/hooks/useBrowserOffline'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { isEncryptedFolder } from '@/lib/encryption'
import logger from '@/lib/logger'
import AddMenu from '@/modules/drive/AddMenu/AddMenu'
import {
  closeMenu,
  toggleMenu
} from '@/modules/drive/Toolbar/components/MoreMenu'
import { ScannerProvider } from '@/modules/drive/Toolbar/components/Scanner/ScannerProvider'

export const AddMenuContext = createContext()

const AddMenuProvider = ({
  disabled,
  canCreateFolder,
  canUpload,
  refreshFolderContent,
  children,
  isPublic,
  displayedFolder,
  isSelectionBarVisible,
  componentsProps,
  isReadOnly
}) => {
  const [menuIsVisible, setMenuVisible] = useState(false)
  const isOffline = useBrowserOffline()
  const anchorRef = useRef()
  const { showAlert } = useAlert()
  const { t } = useI18n()

  const handleClose = useCallback(
    () => closeMenu(setMenuVisible),
    [setMenuVisible]
  )

  const handleToggle = useCallback(
    () => toggleMenu(menuIsVisible, setMenuVisible),
    [menuIsVisible, setMenuVisible]
  )

  const isDisabled = useMemo(
    () => disabled || isSelectionBarVisible,
    [disabled, isSelectionBarVisible]
  )

  const isEncryptedDir = useMemo(
    () => isEncryptedFolder(displayedFolder),
    [displayedFolder]
  )

  const handleOfflineClick = useCallback(
    e => {
      e.stopPropagation()
      showAlert({ message: t('alert.offline'), severity: 'error' })
      logger.error(
        `Offline click on AddMenu button detected. Here is the value of window.navigator.onLine: ${window.navigator.onLine}`
      )
    },
    [showAlert, t]
  )

  return (
    <AddMenuContext.Provider
      value={{
        anchorRef,
        handleToggle,
        isDisabled,
        isOffline,
        handleOfflineClick,
        isPublic,
        a11y: {
          'aria-controls': menuIsVisible ? 'add-menu' : undefined,
          'aria-haspopup': true,
          'aria-expanded': menuIsVisible ? true : undefined
        }
      }}
    >
      {children}
      <ScannerProvider displayedFolder={displayedFolder}>
        {menuIsVisible && (
          <AddMenu
            id="add-menu"
            anchorRef={anchorRef}
            handleClose={handleClose}
            canCreateFolder={canCreateFolder}
            canUpload={canUpload}
            refreshFolderContent={refreshFolderContent}
            isPublic={isPublic}
            isEncryptedFolder={isEncryptedDir}
            displayedFolder={displayedFolder}
            isReadOnly={isReadOnly}
            {...componentsProps?.AddMenu}
          />
        )}
      </ScannerProvider>
    </AddMenuContext.Provider>
  )
}

export default React.memo(AddMenuProvider)
