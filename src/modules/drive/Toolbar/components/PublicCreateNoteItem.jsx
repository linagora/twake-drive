import React from 'react'
import { useNavigate } from 'react-router-dom'

import { Icon, FileTypeNote } from '@linagora/twake-icons'
import { useClient } from 'cozy-client'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { useIsNotesInstalled } from '@/hooks/useIsNotesInstalled'

const PublicCreateNoteItem = ({ displayedFolder, onClick }) => {
  const client = useClient()
  const { showAlert } = useAlert()
  const { t } = useI18n()
  const navigate = useNavigate()
  const isNotesInstalled = useIsNotesInstalled()

  if (!isNotesInstalled) {
    return null
  }

  const handleClick = async () => {
    onClick()
    try {
      const { data: file } = await client.collection('io.cozy.notes').create({
        dir_id: displayedFolder?.id
      })
      navigate(`/note/${file.id}`)
    } catch (_error) {
      showAlert({ message: t('alert.folder_generic'), severity: 'error' })
    }
  }

  return (
    <ActionsMenuItem data-testid="create-a-note" onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={FileTypeNote} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_create_note')} />
    </ActionsMenuItem>
  )
}

export default PublicCreateNoteItem
