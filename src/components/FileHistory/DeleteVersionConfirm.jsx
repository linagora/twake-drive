import { Icon, Forbidden, Trash } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React, { useCallback, useState } from 'react'

import { useClient } from 'cozy-client'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import List from 'cozy-ui/transpiled/react/List'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { destroyFileVersion } from '@/lib/versions'
import { buildFileVersionsQuery } from '@/queries'

export const DeleteVersionConfirm = ({ file, version, onClose }) => {
  const { t, f } = useI18n()
  const client = useClient()
  const { showAlert } = useAlert()
  const [isBusy, setBusy] = useState(false)

  const onDelete = useCallback(async () => {
    try {
      setBusy(true)
      await destroyFileVersion({ client, driveId: file.driveId, version })
      client.resetQuery(buildFileVersionsQuery(file._id).options.as)
    } catch (_e) {
      showAlert({
        message: t('History.deleteVersion.error'),
        severity: 'error'
      })
    } finally {
      onClose()
      setBusy(false)
    }
  }, [client, file, version, onClose, showAlert, t])

  const fileCollection = client.collection('io.cozy.files', {
    driveId: file.driveId
  })

  return (
    <ConfirmDialog
      open={true}
      onClose={onClose}
      title={t('History.deleteVersion.title')}
      content={
        <List>
          <ListItem gutters="disabled" size="small" ellipsis={false}>
            <ListItemIcon>
              <Icon icon={Trash} />
            </ListItemIcon>
            <ListItemText
              primary={t('History.deleteVersion.version', {
                date: f(version.updated_at, 'dd LLLL - HH:mm'),
                size: fileCollection.getBeautifulSize(version)
              })}
            />
          </ListItem>
          <ListItem gutters="disabled" size="small" ellipsis={false}>
            <ListItemIcon>
              <Icon icon={Forbidden} />
            </ListItemIcon>
            <ListItemText primary={t('History.deleteVersion.irreversible')} />
          </ListItem>
        </List>
      }
      actions={
        <>
          <Buttons
            variant="secondary"
            onClick={onClose}
            label={t('History.deleteVersion.cancel')}
          />
          <Buttons
            busy={isBusy}
            color="error"
            label={t('History.deleteVersion.confirm')}
            onClick={onDelete}
          />
        </>
      }
    />
  )
}

DeleteVersionConfirm.propTypes = {
  file: PropTypes.object.isRequired,
  version: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired
}
