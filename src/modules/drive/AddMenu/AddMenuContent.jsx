import React, { forwardRef } from 'react'
import { useI18n } from 'twake-i18n'

import flag from 'cozy-flags'
import ActionsMenuMobileHeader from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuMobileHeader'
import Divider from 'cozy-ui/transpiled/react/Divider'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import AddEncryptedFolderItem from '@/modules/drive/Toolbar/components/AddEncryptedFolderItem'
import AddFolderItem from '@/modules/drive/Toolbar/components/AddFolderItem'
import AddSharedDriveItem from '@/modules/drive/Toolbar/components/AddSharedDriveItem'
import CreateDocsItem from '@/modules/drive/Toolbar/components/CreateDocsItem'
import CreateNoteItem from '@/modules/drive/Toolbar/components/CreateNoteItem'
import CreateOnlyOfficeItem from '@/modules/drive/Toolbar/components/CreateOnlyOfficeItem'
import CreateShortcut from '@/modules/drive/Toolbar/components/CreateShortcut'
import { ScannerMenuItem } from '@/modules/drive/Toolbar/components/Scanner/ScannerMenuItem'
import { useScannerContext } from '@/modules/drive/Toolbar/components/Scanner/ScannerProvider'
import UploadItem from '@/modules/drive/Toolbar/components/UploadItem'
import { isFolderFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'
import { NewItemHighlightProvider } from '@/modules/upload/NewItemHighlightProvider'
import { isOfficeEditingEnabled } from '@/modules/views/OnlyOffice/helpers'

const AddMenuContent = forwardRef(
  (
    {
      isUploadDisabled,
      canCreateFolder,
      canUpload,
      refreshFolderContent,
      isPublic,
      isEncryptedFolder,
      displayedFolder,
      onClick,
      isReadOnly
    },
    ref // eslint-disable-line no-unused-vars
  ) => {
    const { t } = useI18n()
    const { isDesktop } = useBreakpoints()
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

        {canCreateFolder && !isEncryptedFolder && (
          <AddFolderItem onClick={onClick} isReadOnly={isReadOnly} />
        )}
        {canCreateFolder && !isPublic && flag('drive.shared-drive.enabled') && (
          <AddSharedDriveItem onClick={onClick} isReadOnly={isReadOnly} />
        )}
        {canCreateFolder && !isPublic && flag('drive.enable-encryption') && (
          <AddEncryptedFolderItem onClick={onClick} isReadOnly={isReadOnly} />
        )}
        {!isPublic && !isEncryptedFolder && (
          <CreateNoteItem
            displayedFolder={displayedFolder}
            isReadOnly={isReadOnly}
            onClick={onClick}
          />
        )}
        {!isPublic &&
          !isEncryptedFolder &&
          flag('drive.lasuitedocs.enabled') && (
            <CreateDocsItem
              displayedFolder={displayedFolder}
              isReadOnly={isReadOnly}
              onClick={onClick}
            />
          )}
        {canUpload &&
          isOfficeEditingEnabled(isDesktop) &&
          !isEncryptedFolder && (
            <>
              <CreateOnlyOfficeItem
                fileClass="text"
                isReadOnly={isReadOnly}
                onClick={onClick}
              />
              <CreateOnlyOfficeItem
                fileClass="spreadsheet"
                isReadOnly={isReadOnly}
                onClick={onClick}
              />
              <CreateOnlyOfficeItem
                fileClass="slide"
                isReadOnly={isReadOnly}
                onClick={onClick}
              />
            </>
          )}
        {!isEncryptedFolder &&
          !isFolderFromSharedDriveRecipient(displayedFolder) && (
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
