import React from 'react'

import { useQuery } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import useDocument from '@/components/useDocument'
import useCurrentFolderId from '@/hooks/useCurrentFolderId'
import { DOCTYPE_FILES } from '@/lib/doctypes'
import Nav from '@/modules/navigation/Nav'
import { findDownloadsSubfolderId } from '@/modules/navigation/helpers'
import { buildDownloadsFolderQuery } from '@/queries'

const NavWrapper = () => {
  const { isDesktop } = useBreakpoints()
  const downloadsFolderQuery = buildDownloadsFolderQuery()
  const { data: downloadsFolders } = useQuery(downloadsFolderQuery.definition, {
    ...downloadsFolderQuery.options,
    enabled: isDesktop
  })
  const currentFolderId = useCurrentFolderId()
  // Read from the store rather than fetched: a folder opened from a list is
  // already there, so the navigation does not wait for its own request.
  const currentFolder = useDocument(DOCTYPE_FILES, currentFolderId)
  const downloadsFolder = isDesktop ? (downloadsFolders?.[0] ?? null) : null
  const downloadsFolderId = downloadsFolder?._id ?? null
  const displayedDownloadsSubfolderId = findDownloadsSubfolderId(
    downloadsFolder,
    currentFolder
  )

  return (
    <Nav
      downloadsFolderId={downloadsFolderId}
      displayedDownloadsSubfolderId={displayedDownloadsSubfolderId}
    />
  )
}

export default NavWrapper
