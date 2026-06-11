import React, { useRef } from 'react'

import { isQueryLoading, useQuery } from 'cozy-client'

import Oops from '@/components/Error/Oops'
import Loader from '@/components/Loader'
import ExcalidrawEditor from '@/modules/views/Excalidraw/ExcalidrawEditor'
import Title from '@/modules/views/Excalidraw/Title'
import { makeEditorFileQuery } from '@/modules/views/editor/queries'

const Editor = ({ fileId, driveId, isPublic = false, isReadOnly = false }) => {
  const flushRef = useRef(null)

  const query = makeEditorFileQuery(fileId, driveId, isPublic)
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
