import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React, { memo } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useI18n } from 'twake-i18n'

import { filePickerLinkModes } from './constants'

const FilePickerFooter = ({
  onConfirm,
  publicLinkState,
  downloadLinkState,
  referenceState,
  publicLinkAction,
  downloadLinkAction,
  referenceAction
}) => {
  const { t } = useI18n()

  const publicLinkLabel =
    publicLinkAction &&
    (publicLinkAction.label ?? t('FilePicker.footer.buttons.publicLink'))
  const downloadLinkLabel =
    downloadLinkAction &&
    (downloadLinkAction.label ??
      t('FilePicker.footer.buttons.temporaryDownloadLink'))
  const referenceLabel =
    referenceAction &&
    (referenceAction.label ?? t('FilePicker.footer.buttons.reference'))

  const handlePublicLinkClick = () => {
    onConfirm(filePickerLinkModes.PUBLIC_LINK)
  }

  const handleTemporaryDownloadLinkClick = () => {
    onConfirm(filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK)
  }

  const handleReferenceClick = () => {
    onConfirm(filePickerLinkModes.REFERENCE)
  }

  const renderAction = (
    label,
    state,
    actionConfig,
    onClick,
    testId,
    variant
  ) => {
    if (!label) return null
    if (state.disabled) {
      const button = (
        <Button data-testid={testId} label={label} onClick={onClick} disabled />
      )
      if (!state.reasonKey) {
        return <span>{button}</span>
      }
      const tooltipTitle =
        state.reasonKey ===
        'FilePicker.constraints.disabledReasons.fileTooLarge'
          ? t(state.reasonKey, {
              maxFileSize: filesize(actionConfig?.maxFileSize ?? 0, {
                base: 10
              })
            })
          : t(state.reasonKey)
      return (
        <Tooltip title={tooltipTitle} placement="top">
          <span>{button}</span>
        </Tooltip>
      )
    }
    return (
      <Button
        data-testid={testId}
        label={label}
        variant={variant}
        onClick={onClick}
      />
    )
  }

  return (
    <>
      {renderAction(
        referenceLabel,
        referenceState,
        referenceAction,
        handleReferenceClick,
        'reference-btn',
        'primary'
      )}
      {renderAction(
        publicLinkLabel,
        publicLinkState,
        publicLinkAction,
        handlePublicLinkClick,
        'public-link-btn',
        'secondary'
      )}
      {renderAction(
        downloadLinkLabel,
        downloadLinkState,
        downloadLinkAction,
        handleTemporaryDownloadLinkClick,
        'temporary-download-link-btn',
        undefined
      )}
    </>
  )
}

FilePickerFooter.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  publicLinkState: PropTypes.shape({
    disabled: PropTypes.bool,
    reasonKey: PropTypes.string
  }),
  downloadLinkState: PropTypes.shape({
    disabled: PropTypes.bool,
    reasonKey: PropTypes.string
  }),
  referenceState: PropTypes.shape({
    disabled: PropTypes.bool,
    reasonKey: PropTypes.string
  }),
  publicLinkAction: PropTypes.object,
  downloadLinkAction: PropTypes.object,
  referenceAction: PropTypes.object
}

FilePickerFooter.defaultProps = {
  publicLinkState: { disabled: true, reasonKey: null },
  downloadLinkState: { disabled: true, reasonKey: null },
  referenceState: { disabled: true, reasonKey: null },
  publicLinkAction: null,
  downloadLinkAction: null,
  referenceAction: null
}

export default memo(FilePickerFooter)
