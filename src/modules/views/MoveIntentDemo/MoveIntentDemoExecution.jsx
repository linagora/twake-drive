import React from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import IntentDialogOpener from 'cozy-ui-plus/dist/Intent/IntentDialogOpener'
import { useI18n } from 'twake-i18n'

export function MoveIntentDemoExecution({
  options,
  disabled,
  outcome,
  onStart,
  onReadyToUse,
  onComplete,
  onDismiss
}) {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  return (
    <>
      <div className="u-mt-1">
        <IntentDialogOpener
          action="MOVE"
          doctype="io.cozy.files"
          options={options}
          closable={false}
          waitForReadyToUse
          fullScreen={isMobile}
          fullWidth
          maxWidth="md"
          classes={{ paper: 'u-h-100' }}
          iframeProps={{ spinnerProps: { middle: true } }}
          onReadyToUse={onReadyToUse}
          onComplete={onComplete}
          onDismiss={onDismiss}
        >
          <Button
            label={t('MoveIntentDemo.open')}
            disabled={disabled}
            onClickCapture={onStart}
          />
        </IntentDialogOpener>
      </div>
      {outcome && (
        <div className="u-mt-1" role="status" data-testid="move-demo-outcome">
          <Typography>
            {t(`MoveIntentDemo.${outcome.status}`, {
              smart_count: outcome.documents?.length ?? 0
            })}
          </Typography>
          {outcome.documents && (
            <pre className="u-ov-auto" data-testid="move-demo-result">
              {JSON.stringify(outcome.documents, null, 2)}
            </pre>
          )}
        </div>
      )}
      <Typography className="u-mt-1">{t('MoveIntentDemo.options')}</Typography>
      <pre className="u-ov-auto" data-testid="move-demo-options">
        {JSON.stringify(outcome?.options ?? options, null, 2)}
      </pre>
    </>
  )
}
