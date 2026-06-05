import React from 'react'

import flag from 'cozy-flags'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import CreateDocsItem from '@/modules/drive/Toolbar/components/CreateDocsItem'
import CreateExcalidrawItem from '@/modules/drive/Toolbar/components/CreateExcalidrawItem'
import CreateNoteItem from '@/modules/drive/Toolbar/components/CreateNoteItem'
import CreateOnlyOfficeItem from '@/modules/drive/Toolbar/components/CreateOnlyOfficeItem'
import { isOfficeEditingEnabled } from '@/modules/views/OnlyOffice/helpers'

// The "create a document" entries of the add menu (note, docs, excalidraw,
// office), grouped so the menu itself stays simple.
const CreateDocumentItems = ({
  isPublic,
  canUpload,
  displayedFolder,
  isReadOnly,
  onClick
}) => {
  const { isDesktop } = useBreakpoints()

  return (
    <>
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
      {flag('drive.excalidraw.enabled') && (!isPublic || canUpload) && (
        <CreateExcalidrawItem isReadOnly={isReadOnly} onClick={onClick} />
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
    </>
  )
}

export default CreateDocumentItems
