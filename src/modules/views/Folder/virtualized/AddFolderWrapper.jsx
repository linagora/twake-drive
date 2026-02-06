import React from 'react'

import { useVaultClient } from 'cozy-keys-lib'
import Table from 'cozy-ui/transpiled/react/Table'
import TableBody from 'cozy-ui/transpiled/react/TableBody'
import TableCell from 'cozy-ui/transpiled/react/TableCell'
import TableHead from 'cozy-ui/transpiled/react/TableHead'
import TableRow from 'cozy-ui/transpiled/react/TableRow'

import styles from '@/styles/folder-view.styl'

import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import AddFolder from '@/modules/filelist/AddFolder'

const AddFolderWrapper = ({
  columns,
  currentFolderId,
  refreshFolderContent,
  driveId
}) => {
  const vaultClient = useVaultClient()
  const { viewType } = useViewSwitcherContext()

  if (viewType === 'grid') {
    return (
      <div className={styles['fil-folder-body-grid']}>
        <AddFolder
          vaultClient={vaultClient}
          currentFolderId={currentFolderId}
          refreshFolderContent={refreshFolderContent}
          driveId={driveId}
        />
      </div>
    )
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          {columns.map((column, idx) => (
            <TableCell
              key={idx}
              className={column.id === 'name' ? 'u-pl-1' : ''}
            >
              {column.label}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell className="u-pl-1">
            <AddFolder
              vaultClient={vaultClient}
              currentFolderId={currentFolderId}
              refreshFolderContent={refreshFolderContent}
              driveId={driveId}
            />
          </TableCell>
          <TableCell>—</TableCell>
          <TableCell>—</TableCell>
          <TableCell>—</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export default AddFolderWrapper
