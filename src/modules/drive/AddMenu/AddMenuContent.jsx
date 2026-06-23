import React, { forwardRef } from 'react'

import ActionsMenuMobileHeader from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuMobileHeader'
import Divider from 'cozy-ui/transpiled/react/Divider'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import AddFolderItem from '@/modules/drive/Toolbar/components/AddFolderItem'
import CreateDocumentItems from '@/modules/drive/Toolbar/components/CreateDocumentItems'
import CreateShortcut from '@/modules/drive/Toolbar/components/CreateShortcut'
import { ScannerMenuItem } from '@/modules/drive/Toolbar/components/Scanner/ScannerMenuItem'
import { useScannerContext } from '@/modules/drive/Toolbar/components/Scanner/ScannerProvider'
import UploadItem from '@/modules/drive/Toolbar/components/UploadItem'
import { isSharedDriveDoc } from '@/modules/shareddrives/helpers'
import { NewItemHighlightProvider } from '@/modules/upload/NewItemHighlightProvider'

const AddMenuContent = forwardRef(
  (
    {
      isUploadDisabled,
      canCreateFolder,
      canUpload,
      refreshFolderContent,
      isPublic,
      displayedFolder,
      onClick,
      isReadOnly
    },
    ref // eslint-disable-line no-unused-vars
  ) => {
    const { t } = useI18n()
    const { hasScanner } = useScannerContext()
    const { showAlert } = useAlert()

    const handleReadOnlyClick = e => {
      e.stopPropagation()
      e.preventDefault()
      showAlert(
        t(
          'AddMenu.readOnlyFolder',
          'This is a read-only folder. You cannot perform this action.'
        ),
        'warning'
      )
      onClick()
    }

    const createActionOnClick = isReadOnly ? handleReadOnlyClick : onClick

    return (
      <>
        <ActionsMenuMobileHeader>
          <ListItemText
            primary={t('toolbar.menu_create')}
            primaryTypographyProps={{ variant: 'h6' }}
          />
        </ActionsMenuMobileHeader>

        {canCreateFolder && (
          <AddFolderItem onClick={onClick} isReadOnly={isReadOnly} />
        )}
        <CreateDocumentItems
          isPublic={isPublic}
          canUpload={canUpload}
          displayedFolder={displayedFolder}
          isReadOnly={isReadOnly}
          onClick={onClick}
        />
        {!isSharedDriveDoc(displayedFolder) && (
          <CreateShortcut
            onCreated={refreshFolderContent}
            onClick={onClick}
            isReadOnly={isReadOnly}
          />
        )}
        {canUpload && !isUploadDisabled && (
          <NewItemHighlightProvider>
            <Divider className="u-mv-half" />
            <UploadItem
              onUploaded={refreshFolderContent}
              displayedFolder={displayedFolder}
              onClick={onClick}
              isReadOnly={isReadOnly}
            />
          </NewItemHighlightProvider>
        )}
        {hasScanner && <ScannerMenuItem onClick={createActionOnClick} />}
      </>
    )
  }
)

AddMenuContent.displayName = 'AddMenuContent'

export default AddMenuContent
