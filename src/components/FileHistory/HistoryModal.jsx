import get from 'lodash/get'
import PropTypes from 'prop-types'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useClient, useCapabilities } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { Dialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import List from 'cozy-ui/transpiled/react/List'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

import { DeleteVersionConfirm } from './DeleteVersionConfirm'
import { HistoryRow } from './HistoryRow'
import styles from './styles.styl'

import { CozyFile } from '@/models'

const formatDate = (date, f) => {
  return f(date, 'dd LLLL - HH:mm')
}

export const HistoryModal = ({ file, revisions, revisionsFetchStatus }) => {
  const client = useClient()
  const { t, f } = useI18n()
  const navigate = useNavigate()
  const { hasWriteAccess } = useSharingContext()
  const [versionToDelete, setVersionToDelete] = useState(null)

  const fileCollection = client.collection('io.cozy.files', {
    driveId: file.driveId
  })
  const capabilities = useCapabilities(client)
  const isFileVersioningEnabled = get(
    capabilities,
    'capabilities.file_versioning'
  )
  // Mirrors how file actions gate on the containing folder, since a file
  // shared through its parent is not keyed by its own id.
  const canDeleteVersions = hasWriteAccess(file.dir_id, file.driveId)

  return (
    <>
      <Dialog
        onClose={() => navigate('../')}
        open={true}
        title={file.name}
        content={
          <>
            <Typography variant="caption" className={styles.HistoryRowCaption}>
              {capabilities.fetchStatus === 'loading' && (
                <span>{t('History.loading')}</span>
              )}
              {capabilities.fetchStatus === 'loaded' &&
                isFileVersioningEnabled && (
                  <span>{t('History.description')}</span>
                )}
              {(capabilities.fetchStatus === 'failed' ||
                (!isFileVersioningEnabled &&
                  capabilities.fetchStatus !== 'loading')) && (
                <span>{t('History.noFileVersionEnabled')}</span>
              )}
            </Typography>
            <List>
              <HistoryRow
                tag={t('History.current_version')}
                primaryText={formatDate(file.updated_at, f)}
                secondaryText={fileCollection.getBeautifulSize(file)}
                onDownload={() => fileCollection.download(file)}
              />
              {revisionsFetchStatus === 'loaded' &&
                revisions.map(revision => (
                  <HistoryRow
                    key={revision._id}
                    primaryText={formatDate(revision.updated_at, f)}
                    secondaryText={fileCollection.getBeautifulSize(revision)}
                    onDownload={() =>
                      fileCollection.download(
                        file,
                        revision.id,
                        CozyFile.generateFileNameForRevision(file, revision, f)
                      )
                    }
                    onDelete={
                      canDeleteVersions
                        ? () => setVersionToDelete(revision)
                        : undefined
                    }
                  />
                ))}
            </List>
            {revisionsFetchStatus === 'loading' && (
              <div className={styles.HistoryRowRevisionLoader}>
                <Spinner size="xxlarge" />
              </div>
            )}
          </>
        }
      />
      {versionToDelete && (
        <DeleteVersionConfirm
          file={file}
          version={versionToDelete}
          onClose={() => setVersionToDelete(null)}
        />
      )}
    </>
  )
}

HistoryModal.propTypes = {
  file: PropTypes.object.isRequired,
  revisions: PropTypes.array,
  revisionsFetchStatus: PropTypes.string.isRequired
}
