import React from 'react'

import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import CreateDocsItem from '@/modules/drive/Toolbar/components/CreateDocsItem'
import CreateExcalidrawItem from '@/modules/drive/Toolbar/components/CreateExcalidrawItem'
import CreateGristItem from '@/modules/drive/Toolbar/components/CreateGristItem'
import CreateNoteItem from '@/modules/drive/Toolbar/components/CreateNoteItem'
import CreateOnlyOfficeItem from '@/modules/drive/Toolbar/components/CreateOnlyOfficeItem'
import { EDITORS } from '@/modules/views/editor/registry'

const OFFICE_DOCUMENT_CLASSES = ['text', 'spreadsheet', 'slide']

// Renders the add-menu "create a document" entry for an editor, keyed by slug
// like the route factories in `editor/routes.jsx`. Only the rendering lives
// here: the React components stay out of the registry (imported by the pure
// dispatch helpers on the file-listing hot path), while the registry owns the
// enablement (`create.isAvailable`). A `null` entry means the editor has no
// add-menu create item.
const CREATE_ITEM_RENDERERS = {
  docs: ({ displayedFolder, isReadOnly, onClick }) => (
    <CreateDocsItem
      displayedFolder={displayedFolder}
      isReadOnly={isReadOnly}
      onClick={onClick}
    />
  ),
  excalidraw: ({ isReadOnly, onClick }) => (
    <CreateExcalidrawItem isReadOnly={isReadOnly} onClick={onClick} />
  ),
  grist: ({ displayedFolder, isReadOnly, onClick }) => (
    <CreateGristItem
      displayedFolder={displayedFolder}
      isReadOnly={isReadOnly}
      onClick={onClick}
    />
  ),
  onlyoffice: ({ isReadOnly, onClick }) =>
    OFFICE_DOCUMENT_CLASSES.map(fileClass => (
      <CreateOnlyOfficeItem
        key={fileClass}
        fileClass={fileClass}
        isReadOnly={isReadOnly}
        onClick={onClick}
      />
    ))
}

// The "create a document" entries of the add menu (note, docs, excalidraw,
// grist, office). Note is not a registry editor (it has no file dispatch), so
// it is rendered on its own; every other entry is driven by the editor
// registry — both its presence and its enablement (`create.isAvailable`) — so
// it stays in sync with file dispatch and the route layer.
const CreateDocumentItems = ({
  isPublic,
  canUpload,
  displayedFolder,
  isReadOnly,
  onClick
}) => {
  const { isDesktop } = useBreakpoints()
  const context = { isPublic, canUpload, isDesktop }
  const itemProps = { displayedFolder, isReadOnly, onClick }

  return (
    <>
      {!isPublic && (
        <CreateNoteItem
          displayedFolder={displayedFolder}
          isReadOnly={isReadOnly}
          onClick={onClick}
        />
      )}
      {EDITORS.filter(
        ({ slug, create }) => create && CREATE_ITEM_RENDERERS[slug]
      ).map(({ slug, create }) =>
        create.isAvailable(context) ? (
          <React.Fragment key={slug}>
            {CREATE_ITEM_RENDERERS[slug](itemProps)}
          </React.Fragment>
        ) : null
      )}
    </>
  )
}

export default CreateDocumentItems
