import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'

import { getSharingsTabForEntry } from './useFilteredSharings'
import { useSharingsTab } from './useSharingsTab'
import withSharedDocumentIds from './withSharedDocumentIds'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import { useCurrentFolderId } from '@/hooks'
import FilesViewer from '@/modules/viewer/FilesViewer'
import { buildSharingsQuery } from '@/queries'

const FilesViewerSharing = ({ sharedDocumentIds }) => {
  const currentFolderId = useCurrentFolderId()
  const filesQuery = buildSharingsQuery({ ids: sharedDocumentIds })
  const results = useQuery(filesQuery.definition, filesQuery.options)
  const navigate = useNavigate()
  // The active tab only lives in ?tab= (see useSharingsTab): navigations
  // must carry the current search over or the tab resets to the default.
  const { search } = useLocation()
  const [tab] = useSharingsTab()
  const { isOwner } = useSharingContext()

  if (results.data) {
    // At the sharings root, next/previous must not leak into files that
    // belong to another tab. Inside a shared folder the whole content
    // belongs to the folder's tab and nested files are unknown to the
    // sharing context (isOwner would misclassify them), so the tab filter
    // only applies at the root.
    const viewableFiles = results.data.filter(
      f =>
        f.type !== 'directory' &&
        (currentFolderId || getSharingsTabForEntry(f, isOwner) === tab)
    )
    const basePath = currentFolderId
      ? `/sharings/${currentFolderId}`
      : '/sharings'
    return (
      <FilesViewer
        files={viewableFiles}
        filesQuery={results}
        onClose={() => navigate({ pathname: basePath, search })}
        onChange={fileId =>
          navigate({ pathname: `${basePath}/file/${fileId}`, search })
        }
      />
    )
  } else {
    return <FilesViewerLoading />
  }
}

export default withSharedDocumentIds(FilesViewerSharing)
