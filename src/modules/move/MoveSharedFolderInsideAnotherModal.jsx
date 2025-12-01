import PropTypes from 'prop-types'
import React from 'react'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { LoaderModal } from '@/components/LoaderModal'
import { getEntriesName } from '@/modules/move/helpers'
import {
  buildFileOrFolderByIdQuery,
  buildSharedDriveFileOrFolderByIdQuery
} from '@/queries'

/**
 * Alert the user when is trying to move a shared folder/file inside another shared folder
 */
const MoveSharedFolderInsideAnotherModal = ({
  entries,
  folderId,
  driveId,
  onCancel,
  onConfirm
}) => {
  const { t } = useI18n()
  const { byDocId } = useSharingContext()
  const folderQuery = driveId
    ? buildSharedDriveFileOrFolderByIdQuery({ fileId: folderId, driveId })
    : buildFileOrFolderByIdQuery(folderId)
  const { fetchStatus, data } = useQuery(
    folderQuery.definition,
    folderQuery.options
  )

  if (fetchStatus === 'loaded') {
    const sharedEntries = entries.filter(
      ({ _id }) => byDocId[_id] !== undefined
    )

    return (
      <ConfirmDialog
        open
        title={t('Move.sharedFolderInsideAnother.title')}
        content={
          <>
            <Typography variant="body1" className="u-mb-half">
              {t('Move.sharedFolderInsideAnother.content_1')}
            </Typography>
            <Typography variant="body1" className="u-mb-half">
              {t('Move.sharedFolderInsideAnother.content_2', {
                source: getEntriesName(entries, t),
                destination: data.name
              })}
            </Typography>
            <ul>
              {sharedEntries.map(({ _id, name }) => (
                <li key={_id}>{name} </li>
              ))}
            </ul>
          </>
        }
        actions={
          <>
            <Buttons
              variant="secondary"
              label={t('Move.sharedFolderInsideAnother.cancel')}
              onClick={onCancel}
            />
            <Buttons
              label={t('Move.sharedFolderInsideAnother.confirm')}
              onClick={onConfirm}
            />
          </>
        }
      />
    )
  }

  return <LoaderModal />
}

MoveSharedFolderInsideAnotherModal.propTypes = {
  /** List of files or folder to move */
  entries: PropTypes.array.isRequired,
  /** Id of the destination folder */
  folderId: PropTypes.string.isRequired,
  /** Function called when the user cancels the move action */
  onCancel: PropTypes.func.isRequired,
  /** Function called when the user confirms the move action */
  onConfirm: PropTypes.func.isRequired
}

export { MoveSharedFolderInsideAnotherModal }
