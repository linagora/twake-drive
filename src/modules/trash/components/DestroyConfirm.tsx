import React, { useState } from 'react'
import { useI18n } from 'twake-i18n'

import { splitFilename } from 'cozy-client/dist/models/file'
import Button from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ForbiddenIcon from 'cozy-ui/transpiled/react/Icons/Forbidden'
import RestoreIcon from 'cozy-ui/transpiled/react/Icons/Restore'
import List from 'cozy-ui/transpiled/react/List'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { File } from '@/components/FolderPicker/types'
import { getEntriesTypeTranslated } from '@/lib/entries'

interface DestroyConfirmProps {
  files: File[]
  onClose: () => void
  onConfirm: () => Promise<void>
}

const DestroyConfirm: React.FC<DestroyConfirmProps> = ({
  files,
  onClose,
  onConfirm
}) => {
  const { t } = useI18n()
  const [isBusy, setBusy] = useState(false)
  const { showAlert } = useAlert()

  const entriesType = getEntriesTypeTranslated(t, files)

  const handleDestroy = async (): Promise<void> => {
    // Prevent double executions
    if (isBusy) return

    setBusy(true)
    try {
      showAlert({
        message: t('DestroyConfirm.processing', {
          smart_count: files.length,
          type: entriesType
        }),
        severity: 'info'
      })
      onClose()
      await onConfirm()
      showAlert({
        message: t('DestroyConfirm.success', {
          smart_count: files.length,
          type: entriesType
        }),
        severity: 'success'
      })
    } catch {
      showAlert({
        message: t('DestroyConfirm.error'),
        severity: 'error'
      })
    } finally {
      setBusy(false)
    }
  }

  const filename = files.length > 0 ? splitFilename(files[0]).filename : ''

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={t('DestroyConfirm.title', {
        filename,
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
              primary={t('DestroyConfirm.forbidden', {
                smart_count: files.length,
                type: entriesType
              })}
            />
          </ListItem>
          <ListItem gutters="disabled" size="small" ellipsis={false}>
            <ListItemIcon>
              <Icon icon={RestoreIcon} />
            </ListItemIcon>
            <ListItemText
              primary={t('DestroyConfirm.restore', {
                smart_count: files.length,
                type: entriesType
              })}
            />
          </ListItem>
        </List>
      }
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            label={t('DestroyConfirm.cancel')}
          />
          <Button
            variant="primary"
            onClick={handleDestroy}
            label={t('DestroyConfirm.delete')}
            color="error"
            busy={isBusy}
          />
        </>
      }
    />
  )
}

export default DestroyConfirm
