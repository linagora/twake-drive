import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient, useQuery } from 'cozy-client'
import Alert from 'cozy-ui/transpiled/react/Alert'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import TrashDuotoneIcon from 'cozy-ui/transpiled/react/Icons/TrashDuotone'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import logger from '@/lib/logger'
import DestroyConfirm from '@/modules/trash/components/DestroyConfirm'
import { buildFileOrFolderByIdQuery } from '@/queries'

const TrashedBanner = ({ fileId, isPublic }) => {
  const { t } = useI18n()
  const client = useClient()
  const navigate = useNavigate()
  const { showAlert } = useAlert()
  const { isMobile } = useBreakpoints()

  const fileQuery = buildFileOrFolderByIdQuery(fileId)
  const fileResult = useQuery(fileQuery.definition, fileQuery.options)

  const [isBusy, setBusy] = useState(false)
  const [isDestroyConfirmationDisplayed, setDestroyConfirmationDisplayed] =
    useState(false)

  const restore = async () => {
    try {
      await client.collection('io.cozy.files').restore(fileId)
      showAlert({
        message: t('TrashedBanner.restoreSuccess'),
        severity: 'secondary'
      })
    } catch (e) {
      logger.warn(`Error while restoring file ${fileId}`, e)
      showAlert({ message: t('TrashedBanner.restoreError'), severity: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const destroy = async () => {
    setDestroyConfirmationDisplayed(true)
  }

  const handleDestroyCancel = () => {
    setDestroyConfirmationDisplayed(false)
  }

  const handleDestroyConfirm = async () => {
    await client?.collection('io.cozy.files').deleteFilePermanently(fileId)
    showAlert({
      message: t('TrashedBanner.destroySuccess'),
      severity: 'secondary'
    })
  }

  return (
    <>
      <Alert
        square
        severity="secondary"
        icon={<Icon icon={TrashDuotoneIcon} size={32} />}
        block={isMobile}
        action={
          !isPublic ? (
            <>
              <Buttons
                size="small"
                variant="text"
                label={t('TrashedBanner.restore')}
                onClick={restore}
                busy={isBusy}
              />
              <Buttons
                size="small"
                variant="text"
                label={t('TrashedBanner.destroy')}
                onClick={destroy}
                disabled={isBusy}
              />
            </>
          ) : null
        }
      >
        {t('TrashedBanner.text')}
      </Alert>
      {isDestroyConfirmationDisplayed ? (
        <DestroyConfirm
          files={[fileResult.data]}
          onCancel={handleDestroyCancel}
          onConfirm={handleDestroyConfirm}
          onClose={navigate(`/trash/${fileResult.data.dir_id}`)}
        />
      ) : null}
    </>
  )
}

export { TrashedBanner }
