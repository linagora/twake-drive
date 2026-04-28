import React, { forwardRef } from 'react'

import flag from 'cozy-flags'
import ActionsMenuMobileHeader from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuMobileHeader'
import Divider from 'cozy-ui/transpiled/react/Divider'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import AddFolderItem from '@/modules/drive/Toolbar/components/AddFolderItem'
import CreateDocsItem from '@/modules/drive/Toolbar/components/CreateDocsItem'
import CreateNoteItem from '@/modules/drive/Toolbar/components/CreateNoteItem'
import CreateOnlyOfficeItem from '@/modules/drive/Toolbar/components/CreateOnlyOfficeItem'
import CreateShortcut from '@/modules/drive/Toolbar/components/CreateShortcut'
import { ScannerMenuItem } from '@/modules/drive/Toolbar/components/Scanner/ScannerMenuItem'
import { useScannerContext } from '@/modules/drive/Toolbar/components/Scanner/ScannerProvider'
import UploadItem from '@/modules/drive/Toolbar/components/UploadItem'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'
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

        {canCreateFolder && (
          <AddFolderItem onClick={onClick} isReadOnly={isReadOnly} />
        )}
        {!isPublic && (
          <CreateNoteItem
            displayedFolder={displayedFolder}
            isReadOnly={isReadOnly}
            onClick={onClick}
          />
        )}
        {!isPublic && flag('drive.lasuitedocs.enabled') && (
          <CreateDocsItem
            displayedFolder={displayedFolder}
            isReadOnly={isReadOnly}
            onClick={onClick}
          />
        )}
        {canUpload && isOfficeEditingEnabled(isDesktop) && (
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
        {!isFromSharedDriveRecipient(displayedFolder) && (
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
