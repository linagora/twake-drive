import {
  Attachment,
  Check,
  CheckCircle,
  Cross,
  Icon,
  Link
} from '@linagora/twake-icons'
import cx from 'classnames'
import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React, { Fragment, memo } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import Button from 'cozy-ui/transpiled/react/Buttons'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { filePickerLinkModes } from './constants'

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
  documentsState,
  publicLinkAction,
  downloadLinkAction,
  documentsAction,
  busyLinkMode,
  selectedItems,
  onClearSelection
}) => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const selectedCount = selectedItems.length
  const hasSelection = selectedCount > 0

  const publicLinkLabel =
    publicLinkAction &&
    (publicLinkAction.label ?? t('FilePicker.footer.buttons.publicLink'))
  const downloadLinkLabel =
    downloadLinkAction &&
    (downloadLinkAction.label ??
      t('FilePicker.footer.buttons.temporaryDownloadLink'))
  const documentsLabel =
    documentsAction &&
    (documentsAction.label ?? t('FilePicker.footer.buttons.documents'))

  // The offered actions in display order; each one after the first is
  // spaced from its predecessor.
  const actions = [
    {
      linkMode: filePickerLinkModes.DOCUMENTS,
      label: documentsLabel,
      state: documentsState,
      actionConfig: documentsAction,
      testId: 'documents-btn',
      icon: Check,
      mobileVariant: 'primary'
    },
    {
      linkMode: filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK,
      label: downloadLinkLabel,
      state: downloadLinkState,
      actionConfig: downloadLinkAction,
      testId: 'temporary-download-link-btn',
      icon: Attachment,
      mobileVariant: 'text'
    },
    {
      linkMode: filePickerLinkModes.PUBLIC_LINK,
      label: publicLinkLabel,
      state: publicLinkState,
      actionConfig: publicLinkAction,
      testId: 'public-link-btn',
      icon: Link,
      mobileVariant: 'primary'
    }
  ].filter(action => action.label)

  const renderAction = (
    {
      linkMode,
      label,
      state,
      actionConfig,
      testId,
      icon: IconComponent,
      mobileVariant
    },
    hasLeftMargin
  ) => {
    const button = (
      <Button
        className={
          isMobile ? cx('u-flex-grow-1', { 'u-ml-1': hasLeftMargin }) : null
        }
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
            onClick={onClearSelection}
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
                className="u-ml-half u-mr-1"
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
        {actions.map((action, index) => (
          <Fragment key={action.linkMode}>
            {renderAction(action, index > 0)}
          </Fragment>
        ))}
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
  documentsState: PropTypes.shape({
    disabled: PropTypes.bool,
    reasonKey: PropTypes.string
  }),
  publicLinkAction: PropTypes.object,
  downloadLinkAction: PropTypes.object,
  documentsAction: PropTypes.object,
  busyLinkMode: PropTypes.string,
  selectedItems: PropTypes.arrayOf(PropTypes.object),
  onClearSelection: PropTypes.func.isRequired
}

FilePickerFooter.defaultProps = {
  publicLinkState: { disabled: true, reasonKey: null },
  downloadLinkState: { disabled: true, reasonKey: null },
  documentsState: { disabled: true, reasonKey: null },
  publicLinkAction: null,
  downloadLinkAction: null,
  documentsAction: null,
  busyLinkMode: null,
  selectedItems: []
}

export default memo(FilePickerFooter)
