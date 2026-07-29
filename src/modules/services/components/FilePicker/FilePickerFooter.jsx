import { Cross, Icon } from '@linagora/twake-icons'
import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React, { memo } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'
import Button from 'cozy-ui/transpiled/react/Buttons'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

import { useSelectionContext } from '@/modules/selection/SelectionProvider'

function getTooltipTitle(t, reasonKey, actionConfig) {
  return reasonKey === 'FilePicker.constraints.disabledReasons.fileTooLarge'
    ? t(reasonKey, {
        maxFileSize: filesize(actionConfig?.maxFileSize ?? 0, { base: 10 })
      })
    : t(reasonKey)
}

const FilePickerFooter = ({ onConfirm, actions }) => {
  const { t } = useI18n()
  const { selectedItems, clearSelection } = useSelectionContext()
  const selectedCount = selectedItems.length

  const renderAction = (label, action) => {
    if (!label) return null

    const { actionConfig, icon: IconComponent, mode, state } = action
    const button = (
      <Button
        data-testid={`${mode}-btn`}
        label={
          <span className="u-flex u-flex-items-center">
            <Icon icon={IconComponent} size={16} />
            <span className="u-ml-half">{label}</span>
          </span>
        }
        variant="primary"
        onClick={() => onConfirm(mode)}
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
        {actions.map((action, index) => {
          if (!action.actionConfig) return null
          const label = action.actionConfig.label ?? t(action.localeKey)
          return (
            <span
              key={action.mode}
              className={index > 0 ? 'u-ml-1' : undefined}
            >
              {renderAction(label, action)}
            </span>
          )
        })}
      </Box>
    </Box>
  )
}

const actionStateShape = PropTypes.shape({
  disabled: PropTypes.bool,
  reasonKey: PropTypes.string
})

FilePickerFooter.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      mode: PropTypes.string.isRequired,
      icon: PropTypes.elementType.isRequired,
      localeKey: PropTypes.string.isRequired,
      state: actionStateShape.isRequired,
      actionConfig: PropTypes.object
    })
  ).isRequired
}

export default memo(FilePickerFooter)
