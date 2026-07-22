import { Attachment, Check, Cross, Icon, Link } from '@linagora/twake-icons'
import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React, { memo } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import Button from 'cozy-ui/transpiled/react/Buttons'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

import { filePickerLinkModes } from './constants'

import { useSelectionContext } from '@/modules/selection/SelectionProvider'

function getTooltipTitle(t, reasonKey, actionConfig) {
  return reasonKey === 'FilePicker.constraints.disabledReasons.fileTooLarge'
    ? t(reasonKey, {
        maxFileSize: filesize(actionConfig?.maxFileSize ?? 0, { base: 10 })
      })
    : t(reasonKey)
}

const FilePickerFooter = ({
  onConfirm,
  publicLinkState,
  downloadLinkState,
  publicLinkAction,
  downloadLinkAction,
  referenceState,
  referenceAction
}) => {
  const { t } = useI18n()
  const { selectedItems, clearSelection } = useSelectionContext()
  const selectedCount = selectedItems.length

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

  const renderAction = (
    label,
    state,
    actionConfig,
    onClick,
    testId,
    IconComponent
  ) => {
    if (!label) return null

    const button = (
      <Button
        data-testid={testId}
        label={
          <span className="u-flex u-flex-items-center">
            <Icon icon={IconComponent} size={16} />
            <span className="u-ml-half">{label}</span>
          </span>
        }
        variant="primary"
        onClick={onClick}
        disabled={state.disabled}
      />
    )

    if (!state.disabled || !state.reasonKey) {
      return <span>{button}</span>
    }

    const tooltipTitle = getTooltipTitle(t, state.reasonKey, actionConfig)
    return (
      <Tooltip title={tooltipTitle} placement="top">
        <span>{button}</span>
      </Tooltip>
    )
  }

  return (
    <Box className="u-flex u-flex-items-center u-flex-justify-between u-w-100">
      {selectedCount > 0 ? (
        <Box className="u-flex u-flex-items-center">
          <IconButton
            onClick={clearSelection}
            size="small"
            aria-label={t('toolbar.clear_selection')}
          >
            <Icon icon={Cross} size={16} />
          </IconButton>
          <Typography variant="body1" className="u-ml-half">
            {selectedCount} {t('SelectionBar.selected_count', selectedCount)}
          </Typography>
        </Box>
      ) : (
        <span />
      )}
      <Box className="u-flex u-flex-items-center">
        {renderAction(
          referenceLabel,
          referenceState,
          referenceAction,
          () => onConfirm(filePickerLinkModes.REFERENCE),
          'reference-btn',
          Check
        )}
        <span className="u-ml-1">
          {renderAction(
            downloadLinkLabel,
            downloadLinkState,
            downloadLinkAction,
            () => onConfirm(filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK),
            'temporary-download-link-btn',
            Attachment
          )}
        </span>
        <span className="u-ml-1">
          {renderAction(
            publicLinkLabel,
            publicLinkState,
            publicLinkAction,
            () => onConfirm(filePickerLinkModes.PUBLIC_LINK),
            'public-link-btn',
            Link
          )}
        </span>
      </Box>
    </Box>
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
  publicLinkAction: PropTypes.object,
  downloadLinkAction: PropTypes.object,
  referenceState: PropTypes.shape({
    disabled: PropTypes.bool,
    reasonKey: PropTypes.string
  }),
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
