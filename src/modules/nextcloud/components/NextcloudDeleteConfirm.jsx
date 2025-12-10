import React, { useState, useCallback } from 'react'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { splitFilename } from 'cozy-client/dist/models/file'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ForbiddenIcon from 'cozy-ui/transpiled/react/Icons/Forbidden'
import RestoreIcon from 'cozy-ui/transpiled/react/Icons/Restore'
import List from 'cozy-ui/transpiled/react/List'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { getEntriesTypeTranslated } from '@/lib/entries'
import { computeNextcloudFolderQueryId } from '@/modules/nextcloud/helpers'

const NextcloudDeleteConfirm = ({ files, onClose }) => {
  const { t } = useI18n()
  const client = useClient()
  const { showAlert } = useAlert()

  const [isBusy, setBusy] = useState(false)

  const onDelete = useCallback(async () => {
    try {
      setBusy(true)
      await client
        .collection('io.cozy.remote.nextcloud.files')
        .destroyAll(files)
      client.resetQuery(
        computeNextcloudFolderQueryId({
          sourceAccount: files[0].cozyMetadata.sourceAccount,
          path: files[0].parentPath
        })
      )
      client.resetQuery(
        computeNextcloudFolderQueryId({
          sourceAccount: files[0].cozyMetadata.sourceAccount,
          path: '/trash/'
        }) + '/trashed'
      )
    } catch (e) {
      showAlert({
        message: t('NextcloudDeleteConfirm.error'),
        severity: 'error'
      })
    } finally {
      onClose()
      setBusy(false)
    }
  }, [client, files, onClose, showAlert, t])

  const entriesType = getEntriesTypeTranslated(t, files)
  return (
    <ConfirmDialog
      open={true}
      onClose={onClose}
      title={t('NextcloudDeleteConfirm.title', {
        filename: splitFilename(files[0]).filename,
        smart_count: files.length,
        type: entriesType
      })}
      content={
        <List>
          <ListItem gutters="disabled" size="small" ellipsis={false}>
            <ListItemIcon>
              <Icon icon={ForbiddenIcon} />
            </ListItemIcon>
            <ListItemText
              primary={t(`NextcloudDeleteConfirm.trash`, {
                smart_count: files.length
              })}
            />
          </ListItem>
          <ListItem gutters="disabled" size="small" ellipsis={false}>
            <ListItemIcon>
              <Icon icon={RestoreIcon} />
            </ListItemIcon>
            <ListItemText primary={t(`NextcloudDeleteConfirm.restore`)} />
          </ListItem>
        </List>
      }
      actions={
        <>
          <Buttons
            variant="secondary"
            onClick={onClose}
            label={t('NextcloudDeleteConfirm.cancel')}
          />
          <Buttons
            busy={isBusy}
            color="error"
            label={t('NextcloudDeleteConfirm.delete')}
            onClick={onDelete}
          />
        </>
      }
    />
  )
}

export { NextcloudDeleteConfirm }
