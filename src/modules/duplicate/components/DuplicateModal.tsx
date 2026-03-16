import React, { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useClient, models } from 'cozy-client'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { OpenFolderButton } from '@/components/Button/OpenFolderButton'
import { FolderPicker } from '@/components/FolderPicker/FolderPicker'
import { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { ROOT_DIR_ID } from '@/constants/config'
import { useCancelable } from '@/modules/move/hooks/useCancelable'
import { computeNextcloudFolderQueryId } from '@/modules/nextcloud/helpers'

interface DuplicateModalProps {
  entries: FolderPickerEntry[]
  currentFolder: File
  onClose: () => void | Promise<void>
  showNextcloudFolder?: boolean
  showSharedDriveFolder?: boolean
  isPublic?: boolean
}

const DuplicateModal: FC<DuplicateModalProps> = ({
  entries,
  currentFolder,
  onClose,
  showNextcloudFolder,
  showSharedDriveFolder,
  isPublic
}) => {
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const { registerCancelable } = useCancelable()
  const client = useClient()
  const navigate = useNavigate()

  const [isBusy, setBusy] = useState(false)

  const handleConfirm = async (folder: File): Promise<void> => {
    try {
      setBusy(true)
      await Promise.all(
        entries.map(async entry => {
          await registerCancelable(
            models.file.copy(client, entry as Partial<File>, folder, {
              driveId: entry.driveId
            })
          )
        })
      )

      const isCopyingInsideNextcloud =
        folder._type === 'io.cozy.remote.nextcloud.files'

      if (isCopyingInsideNextcloud) {
        refreshNextcloudQueries(folder)
      }

      showAlert({
        message: t('DuplicateModal.success', {
          smart_count: entries.length,
          fileName: entries[0].name,
          destinationName:
            folder._id === ROOT_DIR_ID
              ? t('breadcrumb.title_drive')
              : folder.name
        }),
        severity: 'success',
        action: <OpenFolderButton folder={folder} navigate={navigate} />
      })
    } catch (_e) {
      showAlert({
        message: t('DuplicateModal.error'),
        severity: 'error'
      })
    } finally {
      setBusy(false)
      await onClose()
    }
  }

  /**
   * The content from nextcloud queries must be refreshed when coping files
   * This is only a proxy to Nextcloud queries so we don't have real-time or mutations updates
   */
  const refreshNextcloudQueries = (folder: File): void => {
    const queryId = computeNextcloudFolderQueryId({
      sourceAccount: folder.cozyMetadata?.sourceAccount,
      path: folder.path
    })
    void client?.resetQuery(queryId)
  }

  return (
    <FolderPicker
      showNextcloudFolder={showNextcloudFolder}
      showSharedDriveFolder={showSharedDriveFolder}
      currentFolder={currentFolder}
      entries={entries}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onConfirm={handleConfirm}
      onClose={onClose}
      isBusy={isBusy}
      slotProps={{
        header: {
          subTitle: t('DuplicateModal.subTitle')
        },
        footer: {
          confirmLabel: t('DuplicateModal.confirmLabel')
        }
      }}
      canPickEntriesParentFolder
      isPublic={isPublic}
    />
  )
}

export { DuplicateModal }
