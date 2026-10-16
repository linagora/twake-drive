import React from 'react'

import Alert from 'cozy-ui/transpiled/react/Alert'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import IntentDialogOpener from 'cozy-ui-plus/dist/Intent/IntentDialogOpener'
import { useI18n } from 'twake-i18n'

const sourcePickerOptions = {
  multiple: true,
  tabs: ['drive'],
  documents: { accept: ['file'] },
  sharingLink: null,
  downloadLink: null
}
const directoryPickerOptions = {
  multiple: false,
  tabs: ['drive'],
  documents: { accept: ['folder'] },
  sharingLink: null,
  downloadLink: null
}

export function MoveIntentDemoSelection({
  selectedSources,
  sourceError,
  directory,
  directoryError,
  missingDirectory,
  onChooseSources,
  onSourcesComplete,
  onChooseDirectory,
  onDirectoryComplete,
  onClearDirectory
}) {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  return (
    <>
      <IntentDialogOpener
        action="PICK"
        doctype="io.cozy.files"
        options={sourcePickerOptions}
        closable={false}
        waitForReadyToUse
        fullScreen={isMobile}
        fullWidth
        maxWidth="md"
        classes={{ paper: 'u-h-100' }}
        onComplete={onSourcesComplete}
      >
        <Button
          label={t('MoveIntentDemo.chooseSources')}
          variant="secondary"
          onClickCapture={onChooseSources}
        />
      </IntentDialogOpener>
      {sourceError && (
        <Alert severity="error">{t('MoveIntentDemo.invalidSources')}</Alert>
      )}
      {selectedSources.length > 0 && (
        <ul data-testid="move-demo-sources">
          {selectedSources.map(document => (
            <li key={document._id}>{document.name}</li>
          ))}
        </ul>
      )}
      <div className="u-mt-1">
        <IntentDialogOpener
          action="PICK"
          doctype="io.cozy.files"
          options={directoryPickerOptions}
          closable={false}
          waitForReadyToUse
          fullScreen={isMobile}
          fullWidth
          maxWidth="md"
          classes={{ paper: 'u-h-100' }}
          onComplete={onDirectoryComplete}
        >
          <Button
            label={t('MoveIntentDemo.chooseDirectory')}
            variant="secondary"
            onClickCapture={onChooseDirectory}
          />
        </IntentDialogOpener>
        {directory && (
          <>
            <Typography data-testid="move-demo-directory">
              {directory.path || directory.name}
            </Typography>
            <Button
              label={t('MoveIntentDemo.clearDirectory')}
              variant="text"
              onClick={onClearDirectory}
            />
          </>
        )}
      </div>
      {directoryError && (
        <Alert severity="error">{t('MoveIntentDemo.invalidDirectory')}</Alert>
      )}
      {missingDirectory && (
        <Alert severity="error">{t('MoveIntentDemo.directoryRequired')}</Alert>
      )}
    </>
  )
}
