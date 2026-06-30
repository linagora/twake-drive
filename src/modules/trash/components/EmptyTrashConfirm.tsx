import { Icon, Forbidden, Restore } from '@linagora/twake-icons'
import React, { useCallback, useState } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import List from 'cozy-ui/transpiled/react/List'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

interface EmptyTrashConfirmProps {
  onConfirm: () => Promise<void>
  onClose: () => void
}

const EmptyTrashConfirm: React.FC<EmptyTrashConfirmProps> = ({
  onConfirm,
  onClose
}) => {
  const { t } = useI18n()
  const { showAlert } = useAlert()

  const [isBusy, setBusy] = useState(false)

  const handleConfirm = useCallback(async () => {
    try {
      showAlert({
        message: t('EmptyTrashConfirm.processing'),
        severity: 'info'
      })
      setBusy(true)
      await onConfirm()
      showAlert({
        message: t('EmptyTrashConfirm.success'),
        severity: 'success'
      })
    } catch {
      showAlert({
        message: t('EmptyTrashConfirm.error'),
        severity: 'error'
      })
    } finally {
      setBusy(false)
      onClose()
    }
  }, [onConfirm, onClose, showAlert, t])

  return (
    <ConfirmDialog
      open={true}
      onClose={onClose}
      title={t('EmptyTrashConfirm.title')}
      content={
        <List>
          <ListItem gutters="disabled" size="small" ellipsis={false}>
            <ListItemIcon>
              <Icon icon={Forbidden} />
            </ListItemIcon>
            <ListItemText primary={t('EmptyTrashConfirm.forbidden')} />
          </ListItem>
          <ListItem gutters="disabled" size="small" ellipsis={false}>
            <ListItemIcon>
              <Icon icon={Restore} />
            </ListItemIcon>
            <ListItemText primary={t('EmptyTrashConfirm.restore')} />
          </ListItem>
        </List>
      }
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            label={t('EmptyTrashConfirm.cancel')}
          />
          <Button
            variant="primary"
            onClick={handleConfirm}
            label={t('EmptyTrashConfirm.delete')}
            color="error"
            busy={isBusy}
          />
        </>
      }
    />
  )
}

export { EmptyTrashConfirm }
