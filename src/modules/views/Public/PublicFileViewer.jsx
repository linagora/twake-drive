import React, { useMemo, useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'

import Viewer, {
  FooterActionButtons,
  ForwardOrDownloadButton
} from 'cozy-viewer'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import useHead from '@/components/useHead'
import { useCurrentFolderId } from '@/hooks'
import { isPdfEditorEnabled, makePdfRoute } from '@/modules/views/Pdf/helpers'
import usePublicFilesQuery from '@/modules/views/Public/usePublicFilesQuery'

const PublicFileViewer = () => {
  const { fileId } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useHead()

  const pdfOpener = useCallback(
    file => {
      navigate(
        makePdfRoute(file.id, {
          fromPathname: pathname,
          fromPublicFolder: true
        })
      )
    },
    [navigate, pathname]
  )

  const [fetchingMore, setFetchingMore] = useState(false)

  const currentFolderId = useCurrentFolderId()

  const filesResult = usePublicFilesQuery(currentFolderId)
  const viewableFiles = filesResult.data.filter(f => f.type !== 'directory')

  const currentIndex = useMemo(() => {
    return viewableFiles.findIndex(f => f.id === fileId)
  }, [viewableFiles, fileId])
  const hasCurrentIndex = useMemo(() => currentIndex != -1, [currentIndex])
  const viewerIndex = useMemo(
    () => (hasCurrentIndex ? currentIndex : 0),
    [hasCurrentIndex, currentIndex]
  )

  useEffect(() => {
    let isMounted = true

    // If we can found the current file but we know there is more file inside the folder
    const fetchMoreIfNecessary = async () => {
      if (fetchingMore) {
        return
      }

      setFetchingMore(true)
      try {
        const currentIndex = viewableFiles.findIndex(f => f.id === fileId)

        if (
          (currentIndex === -1 ||
            currentIndex === filesResult.data.length - 1) &&
          filesResult.hasMore &&
          isMounted
        ) {
          await filesResult.fetchMore()
        }
      } finally {
        setFetchingMore(false)
      }
    }

    fetchMoreIfNecessary()

    return () => {
      isMounted = false
    }
  }, [fetchingMore, filesResult, fileId, viewableFiles])

  const handleChange = ({ _id }) => {
    navigate(`../${_id}`, {
      relative: 'path'
    })
  }

  const handleClose = () => {
    navigate('..')
  }

  // If we can't find the file, we fallback to the (potentially loading)
  // direct stat made by the viewer
  if (currentIndex === -1) {
    return <FilesViewerLoading />
  }

  return (
    <Viewer
      files={viewableFiles}
      currentIndex={viewerIndex}
      isPublic={true}
      onChangeRequest={handleChange}
      onCloseRequest={handleClose}
      componentsProps={{
        PdfViewer: {
          isPdfEditorEnabled: isPdfEditorEnabled(),
          opener: pdfOpener
        },
        toolbarProps: {
          hideSummarizeBtn: true
        }
      }}
    >
      <FooterActionButtons>
        <ForwardOrDownloadButton />
      </FooterActionButtons>
    </Viewer>
  )
}

export { PublicFileViewer }
