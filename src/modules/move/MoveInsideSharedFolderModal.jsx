import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

import { useQuery } from 'cozy-client'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'

import { LoaderModal } from '@/components/LoaderModal'
import { getEntriesTypeTranslated } from '@/lib/entries'
import {
  buildFileOrFolderByIdQuery,
  buildSharedDriveFileOrFolderByIdQuery
} from '@/queries'

/**
 * Alert the user when is trying to move a folder/file inside of a shared folder
 */
const MoveInsideSharedFolderModal = ({
  entries,
  folderId,
  driveId,
  onCancel,
  onConfirm
}) => {
  const { t } = useI18n()

  const folderQuery = driveId
    ? buildSharedDriveFileOrFolderByIdQuery({ fileId: folderId, driveId })
    : buildFileOrFolderByIdQuery(folderId)
  const { fetchStatus, data } = useQuery(
    folderQuery.definition,
    folderQuery.options
  )

  if (fetchStatus === 'loaded') {
    const type = getEntriesTypeTranslated(t, entries)

    return (
      <ConfirmDialog
        open
        title={t('Move.insideSharedFolder.title')}
        content={t('Move.insideSharedFolder.content', {
          destination: data.name,
          source: entries[0].name,
          type,
          smart_count: entries.length
        })}
        actions={
          <>
            <Buttons
              variant="secondary"
              label={t('Move.insideSharedFolder.cancel')}
              onClick={onCancel}
            />
            <Buttons
              label={t('Move.insideSharedFolder.confirm')}
              onClick={onConfirm}
            />
          </>
        }
      />
    )
  }

  return <LoaderModal />
}

MoveInsideSharedFolderModal.propTypes = {
  /** List of files or folder to move */
  entries: PropTypes.array.isRequired,
  /** Function called when the user cancels the move action */
  onCancel: PropTypes.func.isRequired,
  /** Function called when the user confirms the move action */
  onConfirm: PropTypes.func.isRequired
}

export { MoveInsideSharedFolderModal }
