import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'

import { useSharingsRootList } from './SharingsRootListContext'
import { isSharingsEntryMatchingFilters } from './matchSharingsFilters'
import { getSharingsTabForEntry } from './useFilteredSharings'
import { useSharingsFilters } from './useSharingsFilters'
import { useSharingsTab } from './useSharingsTab'
import withSharedDocumentIds from './withSharedDocumentIds'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import { useCurrentFolderId } from '@/hooks'
import { useFileLastUpdated } from '@/modules/filelist/FileLastUpdatedContext'
import FilesViewer from '@/modules/viewer/FilesViewer'
import { sortFiles } from '@/modules/views/Folder/sortFiles'
import { getSharingsTabRoute } from '@/modules/views/Sharings/routes'
import { buildSharingsQuery } from '@/queries'

const FilesViewerSharing = ({ sharedDocumentIds }) => {
  const currentFolderId = useCurrentFolderId()
  const filesQuery = buildSharingsQuery({ ids: sharedDocumentIds })
  const results = useQuery(filesQuery.definition, filesQuery.options)
  const navigate = useNavigate()
  const { search } = useLocation()
  const [tab] = useSharingsTab()
  const { filters } = useSharingsFilters(tab)
  const { isOwner } = useSharingContext()
  const rootList = useSharingsRootList()
  const { getFileLastUpdatedAt, groupDirectoriesFirstByUpdatedAt } =
    useFileLastUpdated()

  if (results.data) {
    // At the sharings root, next/previous must not leak into files that
    // belong to another tab. Inside a shared folder the whole content
    // belongs to the folder's tab and nested files are unknown to the
    // sharing context (isOwner would misclassify them), so the tab filter
    // only applies at the root.
    // Reuse the rendered root list so viewer navigation matches its filters
    // and contextual activity order without issuing another query.
    const rootEntries =
      rootList?.entries ??
      results.data.filter(
        file =>
          getSharingsTabForEntry(file, isOwner) === tab &&
          isSharingsEntryMatchingFilters(file, filters, getFileLastUpdatedAt)
      )
    const viewableFiles = currentFolderId
      ? results.data.filter(file => file.type !== 'directory')
      : sortFiles(
          rootEntries.filter(file => file.type !== 'directory'),
          rootList?.sortOrder ?? {
            attribute: 'updated_at',
            order: 'desc'
          },
          {
            getFileLastUpdatedAt,
            groupDirectoriesFirstByUpdatedAt
          }
        )
    const tabPath = getSharingsTabRoute(tab)
    const basePath = currentFolderId
      ? `${tabPath}/folder/${currentFolderId}`
      : tabPath
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
