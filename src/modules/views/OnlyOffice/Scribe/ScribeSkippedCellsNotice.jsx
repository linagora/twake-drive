import React from 'react'

import Alert from 'cozy-ui/transpiled/react/Alert'
import { useI18n } from 'twake-i18n'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

/**
 * Tells how many selected cells kept their text, the last answer of the
 * surface having no cell for them
 *
 * @param {object} props
 * @param {'panel' | 'popover'} props.surface
 * @param {string} [props.className]
 */
export const ScribeSkippedCellsNotice = ({ surface, className }) => {
  const { t } = useI18n()
  const { skippedCells, dismissSkippedCells } = useScribe()

  if (skippedCells?.surface !== surface) return null

  return (
    <Alert
      severity="warning"
      className={className}
      closeText={t('OnlyOffice.scribe.closeNotice')}
      onClose={dismissSkippedCells}
    >
      {t('OnlyOffice.scribe.skippedCells', { count: skippedCells.count })}
    </Alert>
  )
}
