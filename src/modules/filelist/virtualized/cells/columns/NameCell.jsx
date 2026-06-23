import { filesize } from 'filesize'
import get from 'lodash/get'
import React from 'react'
import { useSelector } from 'react-redux'

import { isDirectory } from 'cozy-client/dist/models/file'

import { useIsInSyncFromSharing } from './useIsInSyncFromSharing'

import {
  isRenaming as isRenamingSelector,
  getRenamingFile
} from '@/modules/drive/rename'
import FileOpener from '@/modules/filelist/FileOpener'
import { useFormattedUpdatedAt } from '@/modules/filelist/useFormattedUpdatedAt'
import FileName from '@/modules/filelist/virtualized/cells/FileName'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const NameCell = ({
  row,
  cell,
  withFilePath,
  onInteractWithFile,
  refreshFolderContent
}) => {
  const { toggleSelectedItem } = useSelectionContext()
  const isRenaming = useSelector(
    state =>
      isRenamingSelector(state) && get(getRenamingFile(state), 'id') === row.id
  )
  const isInSyncFromSharing = useIsInSyncFromSharing(row)
  const formattedUpdatedAt = useFormattedUpdatedAt(
    row.updated_at || row.created_at
  )

  if (!cell) return '—'

  const formattedSize =
    !isDirectory(row) && row.size ? filesize(row.size, { base: 10 }) : undefined

  const toggle = e => {
    e.stopPropagation()
    toggleSelectedItem(row)
  }

  return (
    <FileOpener
      file={row}
      disabled={isInSyncFromSharing}
      toggle={toggle}
      isRenaming={isRenaming}
      onInteractWithFile={onInteractWithFile}
      fillHeight
    >
      <FileName
        attributes={row}
        isRenaming={isRenaming}
        interactive={!isInSyncFromSharing}
        withFilePath={withFilePath}
        formattedSize={formattedSize}
        formattedUpdatedAt={formattedUpdatedAt}
        refreshFolderContent={refreshFolderContent}
        isInSyncFromSharing={isInSyncFromSharing}
      />
    </FileOpener>
  )
}

export default NameCell
