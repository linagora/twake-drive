import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { forwardRef } from 'react'

import TextField from 'cozy-ui/transpiled/react/TextField'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

import styles from './styles.styl'

const FILTER_HEIGHT = 32

const useStyles = makeStyles(theme => ({
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
      backgroundColor: theme.palette.primary.light,
      '&:hover, &.Mui-focused': {
        backgroundColor: theme.palette.primary.light
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
  }
}))

const Filter = forwardRef(function Filter(
  {
    active = false,
    autoWidth = false,
    children,
    className,
    disabled = false,
    label,
    onChange = null,
    options,
    startAdornment = null,
    value = '',
    ...textFieldProps
  },
  ref
) {
  const classes = useStyles()

  return (
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
      select
      size="small"
      value={value}
      variant="filled"
      InputProps={{
        classes: {
          root: classes.root,
          focused: classes.focused,
          disabled: classes.disabled,
          input: classes.input
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
  )
})

Filter.displayName = 'Filter'

Filter.propTypes = {
  active: PropTypes.bool,
  autoWidth: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired
    })
  ).isRequired,
  startAdornment: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
}

export { Filter }
