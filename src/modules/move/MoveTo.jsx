import React from 'react'

import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

import { useMoveDestinationPicker } from './hooks/useMoveDestinationPicker'

import { FolderPickerHeader } from '@/components/FolderPicker/FolderPickerHeader'

const useStyles = makeStyles({
  paper: {
    height: '100%',
    '& .MuiDialogContent-root': {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      padding: '0'
    },
    '& .MuiDialogTitle-root': {
      padding: '0'
    },
    '& .dialogContentInner': {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      marginBottom: 0
    }
  }
})

export function MoveTo(props) {
  const classes = useStyles()
  const { content, actions, isBrowserBusy } = useMoveDestinationPicker(props)

  return (
    <FixedDialog
      open
      onClose={isBrowserBusy ? undefined : props.onClose}
      size="large"
      classes={{ paper: classes.paper }}
      title={<FolderPickerHeader entries={props.entries} />}
      content={content}
      actions={actions}
    />
  )
}
