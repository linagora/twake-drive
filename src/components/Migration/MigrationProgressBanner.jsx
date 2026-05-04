import React, { useCallback, useEffect, useState } from 'react'

import { useClient, useQuery } from 'cozy-client'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import Upload from 'cozy-ui/transpiled/react/Icons/Upload'
import ProgressionBanner from 'cozy-ui/transpiled/react/ProgressionBanner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { NEXTCLOUD_MIGRATIONS_DOCTYPE } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { buildRunningMigrationQuery } from '@/queries'

const SNACKBAR_AUTO_HIDE_MS = 6000

const DumbMigrationProgressBanner = ({ migrationDoc }) => {
  const { t } = useI18n()
  const client = useClient()
  const { showAlert } = useAlert()

  const migrationId = migrationDoc?._id

  const [isCanceling, setIsCanceling] = useState(false)

  useEffect(() => {
    if (!migrationId) return

    const handleUpdate = doc => {
      if (doc.status === 'completed') {
        showAlert({
          title: t('MigrationProgressBanner.done.title'),
          message: t('MigrationProgressBanner.done.body', {
            count: doc.progress?.files_total ?? 0
          }),
          severity: 'success',
          duration: SNACKBAR_AUTO_HIDE_MS
        })
      }
    }

    client.plugins.realtime.subscribe(
      'updated',
      NEXTCLOUD_MIGRATIONS_DOCTYPE,
      migrationId,
      handleUpdate
    )
    return () => {
      client.plugins.realtime.unsubscribe(
        'updated',
        NEXTCLOUD_MIGRATIONS_DOCTYPE,
        migrationId,
        handleUpdate
      )
    }
  }, [client, migrationId, showAlert, t])

  const handleCancel = useCallback(async () => {
    if (!migrationId || isCanceling) return
    setIsCanceling(true)
    try {
      await client
        .getStackClient()
        .fetchJSON('POST', `/remote/nextcloud/migration/${migrationId}/cancel`)
    } catch (e) {
      if (e.status !== 409) logger.error('Migration cancel failed', e)
    } finally {
      setIsCanceling(false)
    }
  }, [client, migrationId, isCanceling])

  const progress = migrationDoc?.progress
  const percent =
    progress?.bytes_total > 0
      ? Math.round((progress.bytes_imported / progress.bytes_total) * 100)
      : 0

  return (
    <ProgressionBanner
      icon={<Icon icon={Upload} size={16} />}
      text={
        <>
          {t('MigrationProgressBanner.title')}
          {' · '}
          <span data-testid="migration-progress-banner-percent">
            {t('MigrationProgressBanner.percent', { percent })}
          </span>
        </>
      }
      value={percent}
      button={
        <>
          <Typography
            variant="body2"
            color="textSecondary"
            data-testid="migration-progress-banner-importing"
          >
            {t('MigrationProgressBanner.importing', {
              count: progress?.files_total ?? 0
            })}
          </Typography>
          <Buttons
            variant="text"
            size="small"
            label={t('MigrationProgressBanner.cancel')}
            onClick={handleCancel}
            disabled={isCanceling}
            busy={isCanceling}
            data-testid="migration-progress-banner-cancel"
          />
        </>
      }
    />
  )
}

export const MigrationProgressBanner = () => {
  const runningMigrationQuery = buildRunningMigrationQuery()
  const { data: runningMigrations } = useQuery(
    runningMigrationQuery.definition,
    runningMigrationQuery.options
  )
  const migrationDoc = runningMigrations?.[0] ?? null

  if (!migrationDoc) return null

  return <DumbMigrationProgressBanner migrationDoc={migrationDoc} />
}
