import {
  Attachment,
  CheckCircle,
  Cross,
  Icon,
  Link
} from '@linagora/twake-icons'
import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React, { memo } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import Button from 'cozy-ui/transpiled/react/Buttons'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { filePickerLinkModes } from './constants'

import { useSelectionContext } from '@/modules/selection/SelectionProvider'

function getTooltipTitle(t, reasonKey, actionConfig) {
  const filesizeTooltip =
    reasonKey === 'FilePicker.constraints.disabledReasons.fileTooLarge' ||
    reasonKey === 'FilePicker.constraints.disabledReasons.availableSizeExceeded'
  if (filesizeTooltip) {
    return t(reasonKey, {
      maxFileSize: filesize(actionConfig?.maxFileSize ?? 0, { base: 10 }),
      availableSize: filesize(actionConfig?.availableSize ?? 0, { base: 10 })
    })
  }

  if (
    reasonKey === 'FilePicker.constraints.disabledReasons.maxFileCountExceeded'
  ) {
    return t(reasonKey, {
      maxFileCount: actionConfig?.maxFileCount
    })
  }

  return t(reasonKey)
}

const FilePickerFooter = ({
  onConfirm,
  publicLinkState,
  downloadLinkState,
  publicLinkAction,
  downloadLinkAction,
  busyLinkMode
}) => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const { selectedItems, clearSelection } = useSelectionContext()
  const selectedCount = selectedItems.length
  const hasSelection = selectedCount > 0

  const publicLinkLabel =
    publicLinkAction &&
    (publicLinkAction.label ?? t('FilePicker.footer.buttons.publicLink'))
  const downloadLinkLabel =
    downloadLinkAction &&
    (downloadLinkAction.label ??
      t('FilePicker.footer.buttons.temporaryDownloadLink'))

  const renderAction = (
    linkMode,
    label,
    state,
    actionConfig,
    testId,
    IconComponent,
    mobileVariant,
    hasLeftMargin = false
  ) => {
    if (!label) return null

    const mobileMarginClass =
      hasLeftMargin && (downloadLinkLabel || !isMobile) ? 'u-ml-1' : ''
    const button = (
      <Button
        className={isMobile ? `u-flex-grow-1 ${mobileMarginClass}` : null}
        data-testid={testId}
        label={
          isMobile ? (
            label
          ) : (
            <span className="u-flex u-flex-items-center">
              <Icon icon={IconComponent} size={16} />
              <span className="u-ml-half">{label}</span>
            </span>
          )
        }
        variant={isMobile ? mobileVariant : 'primary'}
        onClick={() => onConfirm(linkMode)}
        disabled={state.disabled}
        busy={busyLinkMode === linkMode}
      />
    )

    if (isMobile) return button

    const action =
      !state.disabled || !state.reasonKey ? (
        button
      ) : (
        <Tooltip
          title={getTooltipTitle(t, state.reasonKey, actionConfig)}
          placement="top"
        >
          <span>{button}</span>
        </Tooltip>
      )

    return <span className={hasLeftMargin ? 'u-ml-1' : null}>{action}</span>
  }

  return (
    <Box
      className={
        isMobile
          ? 'u-flex u-flex-items-center u-w-100'
          : 'u-flex u-flex-items-center u-flex-justify-between u-w-100'
      }
    >
      {hasSelection ? (
        <Box className="u-flex u-flex-items-center u-flex-shrink-0">
          <IconButton
            onClick={clearSelection}
            size="small"
            aria-label={t('toolbar.clear_selection')}
          >
            <Icon icon={Cross} size={16} />
          </IconButton>
          {isMobile ? (
            <>
              <Icon
                icon={CheckCircle}
                color="var(--primaryColor)"
                size={16}
                className="u-ml-half"
              />
              <Typography
                variant="body1"
                className="u-ml-half"
                data-testid="file-picker-selected-count"
              >
                {selectedCount}
              </Typography>
            </>
          ) : (
            <Typography variant="body1" className="u-ml-half">
              {selectedCount} {t('SelectionBar.selected_count', selectedCount)}
            </Typography>
          )}
        </Box>
      ) : (
        !isMobile && <span />
      )}
      <Box
        className={
          isMobile
            ? `u-flex u-flex-items-center ${
                hasSelection ? 'u-flex-grow-1' : 'u-w-100'
              }`
            : 'u-flex u-flex-items-center'
        }
      >
        {renderAction(
          filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK,
          downloadLinkLabel,
          downloadLinkState,
          downloadLinkAction,
          'temporary-download-link-btn',
          Attachment,
          'text'
        )}
        {renderAction(
          filePickerLinkModes.PUBLIC_LINK,
          publicLinkLabel,
          publicLinkState,
          publicLinkAction,
          'public-link-btn',
          Link,
          'primary',
          true
        )}
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
  busyLinkMode: PropTypes.string
}

FilePickerFooter.defaultProps = {
  publicLinkState: { disabled: true, reasonKey: null },
  downloadLinkState: { disabled: true, reasonKey: null },
  publicLinkAction: null,
  downloadLinkAction: null,
  busyLinkMode: null
}

export default memo(FilePickerFooter)
