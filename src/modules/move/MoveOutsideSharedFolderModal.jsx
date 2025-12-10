import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Typography from 'cozy-ui/transpiled/react/Typography'

import { LoaderModal } from '@/components/LoaderModal'
import { getEntriesTypeTranslated } from '@/lib/entries'
import { buildFolderByPathQuery } from '@/queries'

/**
 * Alert the user when is trying to move a folder/file outside of a shared folder
 */
const MoveOutsideSharedFolderModal = ({
  entries,
  driveId,
  onCancel,
  onConfirm
}) => {
  const { t } = useI18n()
  const { getSharedParentPath } = useSharingContext()

  const sharedParentPath = getSharedParentPath(entries[0]?.path || '')
  const folderByPathQuery = buildFolderByPathQuery(sharedParentPath)
  const { fetchStatus, data } = useQuery(
    folderByPathQuery.definition,
    folderByPathQuery.options
  )

  if (fetchStatus === 'loaded') {
    const type = getEntriesTypeTranslated(t, entries)

    const sharedFolderName = !driveId
      ? data[0]?.name
      : entries[0]?.path?.split('/')?.[2] ?? ''

    return (
      <ConfirmDialog
        open
        title={t('Move.outsideSharedFolder.title', {
          sharedFolder: sharedFolderName
        })}
        content={
          <>
            <Typography variant="body1" className="u-mb-half">
              {t('Move.outsideSharedFolder.content_1', {
                sharedFolder: sharedFolderName,
                name: entries[0]?.name,
                type,
                smart_count: entries.length
              })}
            </Typography>
            <Typography variant="body1">
              {t('Move.outsideSharedFolder.content_2', {
                name: entries[0]?.name,
                type,
                smart_count: entries.length
              })}
            </Typography>
          </>
        }
        actions={
          <>
            <Buttons
              variant="secondary"
              label={t('Move.outsideSharedFolder.cancel')}
              onClick={onCancel}
            />
            <Buttons
              label={t('Move.outsideSharedFolder.confirm')}
              onClick={onConfirm}
            />
          </>
        }
      />
    )
  }

  return <LoaderModal />
}

MoveOutsideSharedFolderModal.propTypes = {
  /** List of files or folder to move */
  entries: PropTypes.array.isRequired,
  /** Function called when the user cancels the move action */
  onCancel: PropTypes.func.isRequired,
  /** Function called when the user confirms the move action */
  onConfirm: PropTypes.func.isRequired
}

export { MoveOutsideSharedFolderModal }
