import React, { useEffect, useRef, useState } from 'react'

import { useClient } from 'cozy-client'
import Divider from 'cozy-ui/transpiled/react/Divider'
import Paper from 'cozy-ui/transpiled/react/Paper'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { filePickerErrorCodes } from './FilePicker/constants'
import { fetchMoveIntentResults } from './MoveIntent/results'
import { canNavigateToPickerFolder } from './pickerNavigation'

import { FolderPickerHeader } from '@/components/FolderPicker/FolderPickerHeader'
import logger from '@/lib/logger'
import { useMoveDestinationPicker } from '@/modules/move/hooks/useMoveDestinationPicker'
import { useMoveOperation } from '@/modules/move/hooks/useMoveOperation'

export function MoveIntent({ service, moveIntentConfig, onReadyToUse }) {
  const client = useClient()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const [resultError, setResultError] = useState(null)
  const [isFinalizing, setFinalizing] = useState(false)
  // Finalization can be retried, but cannot overlap or outlive a terminal message.
  const finalizingRef = useRef(false)
  const terminatedRef = useRef(false)
  const notifiedSuccessCountRef = useRef(0)
  const canNavigateTo = moveIntentConfig.restrictToDefaultDir
    ? folder =>
        canNavigateToPickerFolder(client, folder, moveIntentConfig.defaultDirId)
    : null

  const notifyMoveSuccess = (folder, entries) => {
    if (entries.length <= notifiedSuccessCountRef.current) return
    notifiedSuccessCountRef.current = entries.length
    showAlert({
      message: t('Move.success', {
        smart_count: entries.length,
        subject: entries.length === 1 ? entries[0].name : '',
        target: folder.name || t('breadcrumb.title_drive')
      }),
      severity: 'success'
    })
  }

  const handleFinalize = async (folder, results) => {
    if (finalizingRef.current || terminatedRef.current) return
    finalizingRef.current = true
    setFinalizing(true)
    setResultError(null)
    try {
      const documents = await fetchMoveIntentResults(client, results, folder)
      terminatedRef.current = true
      service.terminate(documents)
    } catch (error) {
      logger.warn(error)
      setResultError(filePickerErrorCodes.DOCUMENTS_FAILED)
    } finally {
      finalizingRef.current = false
      setFinalizing(false)
    }
  }

  const handleComplete = async (folder, results) => {
    notifyMoveSuccess(
      folder,
      results.map(result => result.source)
    )
    await handleFinalize(folder, results)
  }
  const handleClose = () => {
    if (finalizingRef.current || terminatedRef.current) return
    terminatedRef.current = true
    service.cancel()
  }
  const operation = useMoveOperation({
    entries: moveIntentConfig.entries,
    onClose: handleClose,
    onSuccess: notifyMoveSuccess,
    onComplete: handleComplete,
    validateDestination: folder =>
      destinationPicker.fetchValidatedDestination(folder)
  })
  const handleRetryResult = () =>
    handleFinalize(operation.destination, operation.moveResults)
  const destinationPicker = useMoveDestinationPicker({
    entries: operation.remainingEntries,
    initialLocation: moveIntentConfig.initialLocation,
    availableSections: moveIntentConfig.tabs,
    restrictedRoot: moveIntentConfig.restrictedRoot,
    canNavigateTo,
    onReadyToUse,
    onClose: operation.onClose,
    onConfirm: operation.onConfirm,
    isBusy: operation.isMoveInProgress || isFinalizing,
    isDestinationLocked: operation.isDestinationLocked,
    resultError,
    onRetryResult: resultError ? handleRetryResult : null
  })

  useEffect(() => {
    if (terminatedRef.current) return
    if (destinationPicker.isBrowserBusy) service.hideCross?.()
    else service.showCross?.()
  }, [destinationPicker.isBrowserBusy, service])

  return (
    <>
      <Paper
        square
        className="u-h-100 u-w-100 u-flex u-flex-column"
        data-testid="move-intent"
      >
        <FolderPickerHeader entries={moveIntentConfig.entries} />
        <Divider />
        {destinationPicker.content}
        <Divider />
        <footer className="u-m-1 u-flex u-flex-items-center">
          {destinationPicker.actions}
        </footer>
      </Paper>
      {operation.confirmationDialogs}
    </>
  )
}
