import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'

/**
 * Redirects to /sharings?tab=1 with an alert when the current drive is no
 * longer among the recipient's shared drives (i.e. access has been revoked).
 *
 * @param {string|undefined} driveId - the shared-drive id being viewed
 */
export const useRedirectOnRevokedDrive = driveId => {
  const navigate = useNavigate()
  const { showAlert } = useAlert()
  const { t } = useI18n()
  const { recipientDriveIds, isLoaded } = useSharedDrives()

  useEffect(() => {
    if (!driveId || !isLoaded) return
    if (!recipientDriveIds.includes(driveId)) {
      showAlert({
        message: t('SharedDrive.access_revoked'),
        severity: 'secondary'
      })
      navigate('/sharings?tab=1', { replace: true })
    }
  }, [driveId, isLoaded, recipientDriveIds, navigate, showAlert, t])
}
