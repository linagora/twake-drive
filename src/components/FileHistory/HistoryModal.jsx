import get from 'lodash/get'
import PropTypes from 'prop-types'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { translate } from 'twake-i18n'

import { withClient, useCapabilities } from 'cozy-client'
import { Dialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import HistoryRow from 'cozy-ui/transpiled/react/HistoryRow'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'

import styles from './styles.styl'

import { CozyFile } from '@/models'

const formatDate = (date, f) => {
  return f(date, 'dd LLLL - HH:mm')
}

const HistoryModal = ({
  file,
  revisions,
  client,
  f,
  t,
  revisionsFetchStatus
}) => {
  const fileCollection = client.collection('io.cozy.files', {
    driveId: file.driveId
  })
  const capabilities = useCapabilities(client)
  const isFileVersioningEnabled = get(
    capabilities,
    'capabilities.file_versioning'
  )
  const navigate = useNavigate()

  return (
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
          <HistoryRow
            tag={t('History.current_version')}
            primaryText={formatDate(file.updated_at, f)}
            secondaryText={fileCollection.getBeautifulSize(file)}
            downloadLink={() => {
              fileCollection.download(file)
            }}
          />
          {revisionsFetchStatus === 'loading' && (
            <div className={styles.HistoryRowRevisionLoader}>
              <Spinner size="xxlarge" />
            </div>
          )}
          {revisionsFetchStatus === 'loaded' &&
            revisions.map(revision => {
              return (
                <HistoryRow
                  primaryText={formatDate(revision.updated_at, f)}
                  secondaryText={fileCollection.getBeautifulSize(revision)}
                  key={revision._id}
                  downloadLink={() => {
                    fileCollection.download(
                      file,
                      revision.id,
                      CozyFile.generateFileNameForRevision(file, revision, f)
                    )
                  }}
                />
              )
            })}
        </>
      }
    />
  )
}

HistoryModal.propTypes = {
  file: PropTypes.object.isRequired,
  revisions: PropTypes.array,
  client: PropTypes.object.isRequired,
  f: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  revisionsFetchStatus: PropTypes.string.isRequired
}
export default translate()(withClient(HistoryModal))
