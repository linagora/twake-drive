import React from 'react'

import { FolderOutlined, Icon } from '@linagora/twake-icons'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { useI18n } from 'twake-i18n'

export function MoveDestinationActions({
  canCreateFolder,
  isNavigationLocked,
  isFolderCreationDisplayed,
  onCreate,
  onClose,
  isBrowserBusy,
  onRetryResult,
  onConfirm,
  hasConfirmHandler,
  canConfirm,
  isBusy,
  isValidatingDestination
}) {
  const { t } = useI18n()
  return (
    <>
      {canCreateFolder && (
        <Buttons
          disabled={isNavigationLocked || isFolderCreationDisplayed}
          label={t('Move.addFolder')}
          onClick={onCreate}
          startIcon={<Icon icon={FolderOutlined} size={16} />}
          variant="ghost"
        />
      )}
      <Buttons
        className="u-ml-auto"
        variant="secondary"
        label={t('Move.cancel')}
        onClick={onClose}
        disabled={isBrowserBusy}
      />
      <Buttons
        className="u-ml-1"
        label={onRetryResult ? t('Viewer.loading.retry') : t('Move.action')}
        onClick={onRetryResult || onConfirm}
        disabled={
          isBrowserBusy ||
          (!onRetryResult && (!hasConfirmHandler || !canConfirm))
        }
        busy={isBusy || isValidatingDestination}
      />
    </>
  )
}
