import React, { useState } from 'react'

import Alert from 'cozy-ui/transpiled/react/Alert'
import { Content } from 'cozy-ui/transpiled/react/Layout'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

import { MoveIntentDemoExecution } from './MoveIntentDemoExecution'
import { MoveIntentDemoOptions } from './MoveIntentDemoOptions'
import { MoveIntentDemoSelection } from './MoveIntentDemoSelection'

import Main from '@/modules/layout/Main'

function hasLocalDriveOrigin(document) {
  return !document.driveId && !document.orgDrive && !document.driveOwner
}

function isLocalDocument(document) {
  return (
    document?._type === 'io.cozy.files' &&
    typeof document._id === 'string' &&
    Boolean(document._id.trim()) &&
    hasLocalDriveOrigin(document) &&
    !document.trashed &&
    !document._deleted &&
    document.cozyMetadata?.createdByApp !== 'nextcloud'
  )
}

function getMoveDemoOptions(fileIds, directory, form) {
  return {
    fileIds,
    ...(directory ? { defaultDirId: directory._id } : {}),
    ...(form.restrictToDefaultDir ? { restrictToDefaultDir: true } : {}),
    ...(form.tabs === 'drive' ? { tabs: ['drive'] } : {}),
    ...(form.theme === 'default' ? {} : { theme: { type: form.theme } })
  }
}

function isValidSourceSelection(documents) {
  return (
    Array.isArray(documents) &&
    documents.length > 0 &&
    documents.every(
      document => isLocalDocument(document) && document.type === 'file'
    )
  )
}

function isValidDirectorySelection(documents) {
  return (
    Array.isArray(documents) &&
    documents.length === 1 &&
    isLocalDocument(documents[0]) &&
    documents[0].type === 'directory'
  )
}

export function MoveIntentDemoView() {
  const { t } = useI18n()
  const [form, setForm] = useState({
    restrictToDefaultDir: false,
    tabs: 'default',
    theme: 'default'
  })
  const [outcome, setOutcome] = useState(null)
  const [selectedSources, setSelectedSources] = useState([])
  const [sourceError, setSourceError] = useState(false)
  const [directory, setDirectory] = useState(null)
  const [directoryError, setDirectoryError] = useState(false)
  const fileIds = [...new Set(selectedSources.map(document => document._id))]
  const options = getMoveDemoOptions(fileIds, directory, form)
  const missingDirectory = form.restrictToDefaultDir && !directory

  const handleChange = event => {
    const { name, value, checked, type } = event.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
    setOutcome(null)
  }
  const handleChooseSources = () => {
    setOutcome(null)
    setSourceError(false)
  }
  const handleSourcesComplete = result => {
    result.removeIntentIframe?.()
    const documents = result.document
    const valid = isValidSourceSelection(documents)
    setSelectedSources(valid ? documents : [])
    setSourceError(!valid)
  }
  const handleChooseDirectory = () => {
    setOutcome(null)
    setDirectoryError(false)
  }
  const handleDirectoryComplete = result => {
    result.removeIntentIframe?.()
    const documents = result.document
    const valid = isValidDirectorySelection(documents)
    setDirectory(valid ? documents[0] : null)
    setDirectoryError(!valid)
  }
  const handleClearDirectory = () => {
    setDirectory(null)
    setDirectoryError(false)
    setOutcome(null)
  }
  const handleStart = () => setOutcome({ status: 'opening', options })
  const handleReadyToUse = () =>
    setOutcome(previous => ({ ...previous, status: 'ready' }))
  const handleComplete = result => {
    result.removeIntentIframe?.()
    setOutcome(previous => ({
      ...previous,
      status: 'completed',
      documents: result.document
    }))
    setSelectedSources([])
  }
  const handleDismiss = () =>
    setOutcome(previous => ({ ...previous, status: 'cancelled' }))

  return (
    <Main>
      <Content>
        <div className="u-p-1-half" data-testid="move-intent-demo">
          <Typography variant="h4" component="h1" gutterBottom>
            {t('MoveIntentDemo.title')}
          </Typography>
          <Alert severity="warning" className="u-mb-1">
            {t('MoveIntentDemo.warning')}
          </Alert>
          <Typography paragraph>{t('MoveIntentDemo.recovery')}</Typography>
          <MoveIntentDemoSelection
            selectedSources={selectedSources}
            sourceError={sourceError}
            directory={directory}
            directoryError={directoryError}
            missingDirectory={missingDirectory}
            onChooseSources={handleChooseSources}
            onSourcesComplete={handleSourcesComplete}
            onChooseDirectory={handleChooseDirectory}
            onDirectoryComplete={handleDirectoryComplete}
            onClearDirectory={handleClearDirectory}
          />
          <MoveIntentDemoOptions form={form} onChange={handleChange} />
          <MoveIntentDemoExecution
            options={options}
            disabled={!fileIds.length || missingDirectory}
            outcome={outcome}
            onStart={handleStart}
            onReadyToUse={handleReadyToUse}
            onComplete={handleComplete}
            onDismiss={handleDismiss}
          />
        </div>
      </Content>
    </Main>
  )
}
