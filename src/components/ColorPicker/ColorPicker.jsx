import PropTypes from 'prop-types'
import React from 'react'

import Circle from 'cozy-ui/transpiled/react/Circle'
import GridList from 'cozy-ui/transpiled/react/GridList'
import GridListTile from 'cozy-ui/transpiled/react/GridListTile'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import CheckIcon from 'cozy-ui/transpiled/react/Icons/Check'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import {
  COLORS,
  NB_COLUMNS_MOBILE,
  NB_COLUMNS_DESKTOP,
  CELL_HEIGHT_MOBILE,
  CELL_HEIGHT_DESKTOP,
  CIRCLE_SIZE_MOBILE,
  CIRCLE_SIZE_DESKTOP,
  ICON_SIZE_MOBILE,
  ICON_SIZE_DESKTOP
} from './constants'

import styles from '@/styles/folder-customizer.styl'

/**
 * ColorPicker component - displays a grid of colors and allows the user to select one
 * @param {Object} props
 * @param {string} props.selectedColor - Currently selected color
 * @param {Function} props.onColorSelect - Callback function when a color is selected
 */
export const ColorPicker = ({ selectedColor, onColorSelect }) => {
  const { isMobile } = useBreakpoints()
  return (
    <>
      <GridList
        cols={isMobile ? NB_COLUMNS_MOBILE : NB_COLUMNS_DESKTOP}
        cellHeight={isMobile ? CELL_HEIGHT_MOBILE : CELL_HEIGHT_DESKTOP}
      >
        <GridListTile className="u-ta-center">
          <Circle
            size={isMobile ? CIRCLE_SIZE_MOBILE : CIRCLE_SIZE_DESKTOP}
            backgroundColor="var(--papeBackgroundColor)"
            className={styles.noneIconFrame}
          >
            <IconButton onClick={() => onColorSelect()}>
              <Icon
                size={isMobile ? ICON_SIZE_MOBILE : ICON_SIZE_DESKTOP}
                icon={CrossIcon}
                color="textSecondary"
              />
            </IconButton>
          </Circle>
        </GridListTile>
        {COLORS.map(color => (
          <GridListTile key={color} className="u-ta-center">
            <Circle
              size={isMobile ? CIRCLE_SIZE_MOBILE : CIRCLE_SIZE_DESKTOP}
              backgroundColor={color}
            >
              <IconButton onClick={() => onColorSelect(color)}>
                {selectedColor === color && (
                  <Icon
                    size={isMobile ? ICON_SIZE_MOBILE : ICON_SIZE_DESKTOP}
                    icon={CheckIcon}
                    color="white"
                  />
                )}
              </IconButton>
            </Circle>
          </GridListTile>
        ))}
      </GridList>
    </>
  )
}

ColorPicker.propTypes = {
  selectedColor: PropTypes.string.isRequired,
  onColorSelect: PropTypes.func.isRequired
}

ColorPicker.displayName = 'ColorPicker'
