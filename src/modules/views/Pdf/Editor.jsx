import React, { useRef } from 'react'

import { isQueryLoading, useQuery } from 'cozy-client'

import Oops from '@/components/Error/Oops'
import Loader from '@/modules/views/Pdf/Loader'
import PdfEditor from '@/modules/views/Pdf/PdfEditor'
import Title from '@/modules/views/Pdf/Title'
import { usePdfAuthor } from '@/modules/views/Pdf/usePdfAuthor'
import {
  buildFileOrFolderByIdQuery,
  buildFileWhereByIdQuery,
  buildSharedDriveFileOrFolderByIdQuery
} from '@/queries'

const makeFileQuery = (fileId, driveId, isPublic) => {
  if (isPublic) {
    // The where-query returns 403 over a public sharecode.
    return buildFileOrFolderByIdQuery(fileId)
  }
  if (driveId) {
    return buildSharedDriveFileOrFolderByIdQuery({ fileId, driveId })
  }
  // where-query so the toolbar gets file.path (getById does not return it).
  return buildFileWhereByIdQuery(fileId)
}

const Editor = ({ fileId, driveId, isPublic = false, isReadOnly = false }) => {
  const flushRef = useRef(null)

  const query = makeFileQuery(fileId, driveId, isPublic)
  const fileQuery = useQuery(query.definition, query.options)
  const { data } = fileQuery
  const file = Array.isArray(data) ? data[0] : data

  // Resolve the annotation author before mounting the editor: EmbedPDF reads it
  // from its config at init, so it has to be known up front.
  const { author, isLoading: isAuthorLoading } = usePdfAuthor({ isPublic })

  if (isQueryLoading(fileQuery) || isAuthorLoading) {
    return <Loader />
  }

  if (!file) {
    return <Oops />
  }

  return (
    <>
      <Title
        file={file}
        flushRef={flushRef}
        isPublic={isPublic}
        isReadOnly={isReadOnly}
      />
      <PdfEditor
        key={file._id}
        file={file}
        flushRef={flushRef}
        isReadOnly={isReadOnly}
        author={author}
      />
    </>
  )
}

export default Editor
