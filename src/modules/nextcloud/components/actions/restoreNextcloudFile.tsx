import React, { forwardRef } from 'react'

import CozyClient from 'cozy-client/types/CozyClient'
import { NextcloudFile } from 'cozy-client/types/types'
import { Action } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import RestoreIcon from 'cozy-ui/transpiled/react/Icons/Restore'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { getParentPath } from '@/lib/path'
import { computeNextcloudFolderQueryId } from '@/modules/nextcloud/helpers'

interface NextcloudFilesCollection {
  restore: (file: NextcloudFile) => Promise<void>
}

interface RestoreNextcloudFileProps {
  t: (key: string) => string
  client: CozyClient
  showAlert: import('cozy-ui/transpiled/react/providers/Alert').showAlertFunction
}

export const restoreNextcloudFile = ({
  t,
  client,
  showAlert
}: RestoreNextcloudFileProps): Action<NextcloudFile> => {
  const label = t('RestoreNextcloudFile.label')
  const icon = RestoreIcon

  return {
    name: 'restoreNextcloudFile',
    label,
    icon,
    displayCondition: (files): boolean => files.length > 0,
    action: async (files): Promise<void> => {
      const sourceAccount = files[0].cozyMetadata.sourceAccount
      const parentPath = files[0].parentPath

      try {
        for (const file of files) {
          const collection = client.collection(
            'io.cozy.remote.nextcloud.files'
          ) as unknown as NextcloudFilesCollection
          await collection.restore(file)
        }

        const restorePaths = files
          .map(file =>
            file.restore_path ? getParentPath(file.restore_path) : undefined
          )
          .filter(Boolean)

        const uniqueRestorePaths = Array.from(new Set(restorePaths))

        const resetResults = await Promise.all(
          uniqueRestorePaths.map(restorePath => {
            const queryId = computeNextcloudFolderQueryId({
              sourceAccount,
              path: restorePath
            })
            return client.resetQuery(queryId)
          })
        )

        // If the query for the folder containing the restored files does not exist,
        // we need to reset the query of the current folder to refresh the view.
        // Since the current folder is the trash folder, its queryId ends with '/trashed'.
        if (resetResults.some(query => query === null)) {
          const queryId =
            computeNextcloudFolderQueryId({
              sourceAccount,
              path: parentPath
            }) + '/trashed'
          await client.resetQuery(queryId)
        }

        showAlert({
          message: t('RestoreNextcloudFile.success'),
          severity: 'success'
        })
      } catch (_error) {
        showAlert({
          message: t('RestoreNextcloudFile.error'),
          severity: 'error'
        })
      }
    },
    Component: forwardRef(function RestoreNextcloudFile(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} />
          </ListItemIcon>
          <ListItemText primary={label} />
        </ActionsMenuItem>
      )
    })
  }
}
