import React from 'react'
import { connect } from 'react-redux'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import useBrowserOffline from 'cozy-ui/transpiled/react/hooks/useBrowserOffline'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { abortRenaming } from './rename'
import { isFolderFromSharedDriveOwner } from '../shareddrives/helpers'

import { CozyFile } from '@/models'
import FilenameInput from '@/modules/filelist/FilenameInput'

// If we set the _rev then CozyClient tries to update. Else
// it tries to create
const updateFileNameQuery = async (client, file, newName) => {
  if (isFolderFromSharedDriveOwner(file)) {
    const referencedBy = file.relationships?.referenced_by?.data?.[0]
    if (!referencedBy?.id) {
      throw new Error('Shared drive folder is missing required relationships')
    }
    const sharing = {
      _id: referencedBy.id,
      rules: [{ values: [file.id] }]
    }
    return client
      .collection('io.cozy.sharings')
      .renameSharedDrive(sharing, newName)
  }
  return client.collection('io.cozy.files', { driveId: file.driveId }).update({
    ...file,
    name: newName,
    _rev: file._rev || file.meta.rev
  })
}

export const RenameInput = ({
  onAbort,
  file,
  refreshFolderContent,
  className,
  style,
  withoutExtension
}) => {
  const client = useClient()
  const { showAlert } = useAlert()
  const { t } = useI18n()

  const { filename, extension } = CozyFile.splitFilename(file)
  const name = withoutExtension ? filename : file.name
  const isOffline = useBrowserOffline()

  return (
    <FilenameInput
      className={className}
      style={style}
      name={name}
      file={file}
      onSubmit={async newValue => {
        const newName = withoutExtension ? newValue + extension : newValue
        try {
          if (isOffline) {
            showAlert({ message: t('alert.offline'), severity: 'error' })
          } else {
            await updateFileNameQuery(client, file, newName)
            if (refreshFolderContent) refreshFolderContent()
          }
        } catch (error) {
          if (
            error.message.includes(
              'NetworkError when attempting to fetch resource.'
            )
          ) {
            showAlert({ message: t('upload.alert.network'), severity: 'error' })
          } else if (
            error.message.includes(
              'Invalid filename containing illegal character(s):'
            )
          ) {
            showAlert({
              message: t('alert.file_name_illegal_characters', {
                fileName: newName,
                characters: error.message.split(
                  'Invalid filename containing illegal character(s): '
                )[1]
              }),
              severity: 'error',
              duration: 2000
            })
          } else if (error.message.includes('Invalid filename:')) {
            showAlert({
              message: t('alert.file_name_illegal_name', { fileName: newName }),
              severity: 'error'
            })
          } else if (error.message.includes('Missing name argument')) {
            showAlert({
              message: t('alert.file_name_missing'),
              severity: 'error'
            })
          } else {
            showAlert({
              message: t('alert.file_name', { fileName: newName }),
              severity: 'error'
            })
          }
        } finally {
          onAbort()
        }
      }}
      onAbort={onAbort}
    />
  )
}

const mapDispatchToProps = dispatch => ({
  onAbort: () => dispatch(abortRenaming())
})

export default connect(null, mapDispatchToProps)(RenameInput)
