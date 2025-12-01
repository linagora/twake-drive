import PropTypes from 'prop-types'
import React from 'react'

import ClickAwayListener from 'cozy-ui/transpiled/react/ClickAwayListener'
import GridList from 'cozy-ui/transpiled/react/GridList'
import GridListTile from 'cozy-ui/transpiled/react/GridListTile'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Popper from 'cozy-ui/transpiled/react/Popper'

import { getIcon } from './IconIndex'
import { ICON_COLORS } from './constants'

import styles from '@/styles/folder-customizer.styl'

export const IconColorPicker = ({
  anchorEl,
  selectedIcon,
  iconSize,
  isMobile,
  onPickColor,
  onClose
}) => {
  return (
    <Popper
      open={true}
      anchorEl={anchorEl}
      placement="bottom"
      disablePortal={false}
      className={styles.iconColorPopper}
    >
      <ClickAwayListener onClickAway={onClose} mouseEvent="onMouseDown">
        <Paper className={`u-p-half u-dib ${styles.iconColorPaper}`}>
          <GridList cols={6} cellHeight={isMobile ? 34 : 30}>
            {ICON_COLORS.map(color => (
              <GridListTile key={color} className="u-ta-center">
                <IconButton
                  className="u-p-0"
                  onClick={() => onPickColor(color)}
                >
                  <Icon
                    size={iconSize}
                    icon={getIcon(selectedIcon)}
                    color={color}
                  />
                </IconButton>
              </GridListTile>
            ))}
          </GridList>
        </Paper>
      </ClickAwayListener>
    </Popper>
  )
}

IconColorPicker.propTypes = {
  anchorEl: PropTypes.any,
  selectedIcon: PropTypes.string,
  iconSize: PropTypes.number,
  isMobile: PropTypes.bool,
  onPickColor: PropTypes.func,
  onClose: PropTypes.func
}

IconColorPicker.displayName = 'IconColorPicker'
