import React from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Icon from 'cozy-ui/transpiled/react/Icon'
import DesktopDownloadIcon from 'cozy-ui/transpiled/react/Icons/DesktopDownload'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

import { getDesktopAppDownloadLink } from '@/components/pushClient'
import { usePublicContext } from '@/modules/public/PublicProvider'

const UploadLimitDialog = ({ onClose, maxFileCount }) => {
  const { t } = useI18n()
  const { isPublic } = usePublicContext()

  const handleDownloadDesktop = () => {
    const link = getDesktopAppDownloadLink({ t })
    window.open(link, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={t('upload.limit.title', { limit: maxFileCount })}
      content={
        <Typography>
          {t(isPublic ? 'upload.limit.content_public' : 'upload.limit.content')}
        </Typography>
      }
      actions={
        isPublic ? (
          <Button onClick={onClose} label={t('upload.limit.close')} />
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={onClose}
              label={t('upload.limit.cancel')}
            />
            <Button
              onClick={handleDownloadDesktop}
              label={t('upload.limit.download_desktop')}
              startIcon={<Icon icon={DesktopDownloadIcon} />}
            />
          </>
        )
      }
    />
  )
}

export default UploadLimitDialog
