import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import Alert from 'cozy-ui/transpiled/react/Alert'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Typography from 'cozy-ui/transpiled/react/Typography'

import { useRedirectLink } from '@/hooks/useRedirectLink'
import { DOCTYPE_FILES } from '@/lib/doctypes'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { makeOnlyOfficeFileRoute } from '@/modules/views/OnlyOffice/helpers'

const FileDeletedModal = () => {
  const { fileId, setFileDeleted, editorMode, isPublic } =
    useOnlyOfficeContext()
  const navigate = useNavigate()
  const client = useClient()
  const { t } = useI18n()

  const [isErrorAlertDisplayed, setErrorAlertDisplayed] = useState(false)
  const [isBusy, setBusy] = useState(false)

  const { redirectLink, redirectBack } = useRedirectLink({ isPublic })

  const restore = async () => {
    setErrorAlertDisplayed(false)
    setBusy(isBusy)
    try {
      const resp = await client.collection(DOCTYPE_FILES).restore(fileId)
      const route = makeOnlyOfficeFileRoute(resp.data.id, {
        fromRedirect: redirectLink,
        fromEdit: editorMode === 'edit'
      })
      navigate(route)
      setFileDeleted(false)
    } catch {
      setErrorAlertDisplayed(true)
    } finally {
      setBusy(false)
    }
  }

  const goBack = () => {
    redirectBack()
  }

  return (
    <ConfirmDialog
      open
      title={t('FileDeletedModal.title')}
      content={
        <>
          {isErrorAlertDisplayed ? (
            <Alert severity="error" className="u-mb-1">
              {t('FileDeletedModal.error')}
            </Alert>
          ) : null}
          <Typography>{t('FileDeletedModal.content')}</Typography>
        </>
      }
      actions={
        <>
          <Buttons
            disabled={isBusy}
            variant="secondary"
            color="error"
            label={t('FileDeletedModal.cancel')}
            onClick={goBack}
          />
          <Buttons
            busy={isBusy}
            disabled={isBusy}
            label={t('FileDeletedModal.confirm')}
            onClick={restore}
          />
        </>
      }
    />
  )
}

export { FileDeletedModal }
