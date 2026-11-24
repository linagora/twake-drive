import React from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'

import CircularProgress from 'cozy-ui/transpiled/react/CircularProgress'
import Dialog, { DialogContent } from 'cozy-ui/transpiled/react/Dialog'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

import Oops from '@/components/Error/Oops'
import {
  canWriteOfficeDocument,
  makeOnlyOfficeFileRoute
} from '@/modules/views/OnlyOffice/helpers'
import useCreateFile from '@/modules/views/OnlyOffice/useCreateFile'

const Create = ({ isPublic = false }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { folderId, fileClass, driveId = undefined } = useParams()
  const { status, fileId } = useCreateFile(folderId, fileClass, driveId)
  const folderPath = `/folder/${folderId}`

  if (!canWriteOfficeDocument()) {
    return (
      <Navigate
        to={
          driveId
            ? `/onlyoffice/${driveId}/${folderId}/paywall`
            : `${folderPath}/paywall`
        }
      />
    )
  }

  if (status === 'error') {
    return <Oops />
  }

  if (status === 'loaded' && fileId) {
    const url = makeOnlyOfficeFileRoute(fileId, {
      fromCreate: true,
      fromPathname: driveId
        ? `/shareddrive/${driveId}/${folderId}`
        : folderPath,
      fromPublicFolder: isPublic,
      driveId
    })
    return navigate(url, {
      replace: true
    })
  }

  return (
    <Dialog open={true} fullScreen transitionDuration={0}>
      <DialogContent className="u-flex u-flex-column u-flex-items-center u-flex-justify-center">
        <CircularProgress size={80} />
        <Typography className="u-mt-1" variant="body1" color="textSecondary">
          {t('loading.onlyOfficeCreateInProgress')}
        </Typography>
      </DialogContent>
    </Dialog>
  )
}

export default React.memo(Create)
