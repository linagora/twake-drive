import React, { useRef } from 'react'

import { isQueryLoading, useQuery } from 'cozy-client'

import Oops from '@/components/Error/Oops'
import ExcalidrawEditor from '@/modules/views/Excalidraw/ExcalidrawEditor'
import Loader from '@/modules/views/Excalidraw/Loader'
import Title from '@/modules/views/Excalidraw/Title'
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

  if (isQueryLoading(fileQuery)) {
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
      <ExcalidrawEditor
        key={file._id}
        file={file}
        flushRef={flushRef}
        isReadOnly={isReadOnly}
      />
    </>
  )
}

export default Editor
