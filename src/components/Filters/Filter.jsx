import { CrossSmall, Icon } from '@linagora/twake-icons'
import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { forwardRef } from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import TextField from 'cozy-ui/transpiled/react/TextField'
import { alpha, makeStyles } from 'cozy-ui/transpiled/react/styles'

import styles from './styles.styl'

const FILTER_HEIGHT = 32

const useStyles = makeStyles(theme => ({
  control: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
    gap: theme.spacing(0.5)
  },
  root: {
    height: FILTER_HEIGHT,
    alignItems: 'center',
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    backgroundColor: theme.palette.background.contrast,
    '&:hover, &$focused': {
      backgroundColor: theme.palette.background.contrast
    },
    '&:before, &:after': {
      display: 'none'
    },
    '&$disabled': {
      cursor: 'default'
    }
  },
  active: {
    '& .MuiFilledInput-root': {
      '--iconTextColor': theme.palette.primary.main,
      color: theme.palette.primary.main,
      backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.action.ghostOpacity
      ),
      '&.Mui-focused': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.focusOpacity
        )
      },
      '&:hover': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.hoverGhostOpacity
        )
      }
    }
  },
  focused: {},
  disabled: {},
  selectIcon: {
    top: '50%',
    transform: 'translateY(-50%)'
  },
  selectIconOpen: {
    transform: 'translateY(-50%) rotate(180deg)'
  },
  input: {
    boxSizing: 'border-box',
    height: FILTER_HEIGHT,
    minWidth: 0,
    ...theme.typography.body2,
    lineHeight: `${FILTER_HEIGHT}px`,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    cursor: 'inherit',
    '&:focus': {
      backgroundColor: 'transparent'
    },
    '&&': {
      padding: theme.spacing(0, 4, 0, 2)
    }
  },
  value: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    gap: theme.spacing(1)
  },
  clearButton: {
    width: FILTER_HEIGHT,
    height: FILTER_HEIGHT,
    flexShrink: 0,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.primary.main,
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.action.ghostOpacity
    ),
    '&:hover, &:focus': {
      color: theme.palette.primary.main,
      backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.action.hoverGhostOpacity
      )
    }
  }
}))

const Filter = forwardRef(function Filter(
  {
    active = false,
    autoWidth = false,
    children,
    className,
    clearLabel = null,
    disabled = false,
    InputProps = null,
    label,
    onChange = null,
    onClear = null,
    options,
    select = true,
    startAdornment = null,
    value = '',
    ...textFieldProps
  },
  ref
) {
  const classes = useStyles()

  return (
    <div className={classes.control}>
      <TextField
        {...textFieldProps}
        ref={ref}
        className={cx(
          {
            [classes.active]: active,
            [styles.autoWidth]: autoWidth
          },
          className
        )}
        disabled={disabled}
        fullWidth={!autoWidth}
        hiddenLabel
        options={options}
        onChange={onChange}
        select={select}
        size="small"
        value={value}
        variant="filled"
        InputProps={{
          ...InputProps,
          classes: {
            ...InputProps?.classes,
            root: cx(classes.root, InputProps?.classes?.root),
            focused: cx(classes.focused, InputProps?.classes?.focused),
            disabled: cx(classes.disabled, InputProps?.classes?.disabled),
            input: cx(classes.input, InputProps?.classes?.input)
          }
        }}
        SelectProps={{
          classes: {
            icon: classes.selectIcon,
            iconOpen: classes.selectIconOpen
          },
          displayEmpty: true,
          renderValue: () => (
            <span className={classes.value}>
              {startAdornment}
              <span className="u-ellipsis">{label}</span>
            </span>
          )
        }}
      >
        {children}
      </TextField>

      {active && onClear ? (
        <IconButton
          aria-label={clearLabel}
          className={classes.clearButton}
          disabled={disabled}
          onClick={onClear}
          size="small"
        >
          <Icon icon={CrossSmall} size={12} />
        </IconButton>
      ) : null}
    </div>
  )
})

Filter.displayName = 'Filter'

Filter.propTypes = {
  active: PropTypes.bool,
  autoWidth: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
  clearLabel: PropTypes.string,
  disabled: PropTypes.bool,
  InputProps: PropTypes.object,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  onClear: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired
    })
  ),
  select: PropTypes.bool,
  startAdornment: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
}

export { Filter }
