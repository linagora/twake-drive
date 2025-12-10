import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
import { useI18n } from 'twake-i18n'

import Backdrop from 'cozy-ui/transpiled/react/Backdrop'
import GridList from 'cozy-ui/transpiled/react/GridList'
import GridListTile from 'cozy-ui/transpiled/react/GridListTile'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { Spinner } from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { IconColorPicker } from './IconColorPicker'
import { getIcon, getIconList } from './IconIndex'
import { NoneIcon } from './NoneIcon'
import {
  NB_COLUMNS_MOBILE,
  NB_COLUMNS_DESKTOP,
  CELL_HEIGHT_MOBILE,
  CELL_HEIGHT_DESKTOP,
  ICON_SIZE_MOBILE,
  ICON_SIZE_DESKTOP
} from './constants'

import { useRecentIcons } from '@/hooks'

/**
 * IconPicker component - displays a grid of icons and allows the user to select one
 * @param {Object} props
 * @param {string} props.selectedIcon - Currently selected icon
 * @param {Function} props.onIconSelect - Callback function when an icon is selected
 */

export const IconPicker = ({
  selectedIcon,
  onIconSelect,
  onIconColorSelect,
  scrollContainerRef
}) => {
  const { isMobile } = useBreakpoints()
  const { t } = useI18n()
  const recentIcons = useRecentIcons()
  const icons = getIconList()
  const [anchorEl, setAnchorEl] = useState(null)

  const iconSize = isMobile ? ICON_SIZE_MOBILE : ICON_SIZE_DESKTOP

  // Close color picker when scrolling
  useEffect(() => {
    const container = scrollContainerRef?.current
    if (!anchorEl || !container) return

    const handleScroll = () => {
      setAnchorEl(null)
    }

    container.addEventListener('scroll', handleScroll, true)

    return () => {
      container.removeEventListener('scroll', handleScroll, true)
    }
  }, [anchorEl, scrollContainerRef])

  const handleIconClick = (event, iconName) => {
    if (onIconColorSelect && iconName !== 'none') {
      setAnchorEl(prev => (prev ? null : event.currentTarget))
    }
    onIconSelect(iconName)
  }

  const handleColorPick = color => {
    onIconColorSelect?.(color)
    setAnchorEl(null)
  }

  if (!recentIcons) {
    return (
      <Backdrop isOver open>
        <Spinner size="xxlarge" middle noMargin color="var(--white)" />
      </Backdrop>
    )
  }

  return (
    <>
      {recentIcons.length > 0 && (
        <>
          <Typography className="u-ml-half u-mb-1" variant="h6" noWrap>
            {t('FolderCustomizer.iconPicker.recents')}
          </Typography>
          <GridList
            cols={isMobile ? NB_COLUMNS_MOBILE : NB_COLUMNS_DESKTOP}
            cellHeight={isMobile ? CELL_HEIGHT_MOBILE : CELL_HEIGHT_DESKTOP}
          >
            {recentIcons.map((iconName, index) => (
              <GridListTile key={`recent-${index}`} className="u-ta-center">
                <IconButton
                  onClick={() => onIconSelect(iconName)}
                  size={isMobile ? ICON_SIZE_MOBILE : ICON_SIZE_DESKTOP}
                >
                  <Icon
                    size={isMobile ? ICON_SIZE_MOBILE : ICON_SIZE_DESKTOP}
                    icon={getIcon(iconName)}
                  />
                </IconButton>
              </GridListTile>
            ))}
          </GridList>
        </>
      )}
      <Typography
        className="u-ml-half u-mb-1 u-mt-1 u-mt-0-t"
        variant="h6"
        noWrap
      >
        {t('FolderCustomizer.iconPicker.chooseCustomIcon')}
      </Typography>
      <GridList
        cols={isMobile ? NB_COLUMNS_MOBILE : NB_COLUMNS_DESKTOP}
        cellHeight={isMobile ? CELL_HEIGHT_MOBILE : CELL_HEIGHT_DESKTOP}
      >
        <GridListTile key="none" className="u-ta-center">
          <IconButton onClick={e => handleIconClick(e, 'none')} size={iconSize}>
            <NoneIcon size={iconSize} />
          </IconButton>
        </GridListTile>

        {icons.map((iconName, index) => (
          <GridListTile key={index} className="u-ta-center">
            <IconButton
              onClick={e => handleIconClick(e, iconName)}
              size={iconSize}
              className={selectedIcon === iconName ? 'u-bg-silver' : ''}
            >
              <Icon size={iconSize} icon={getIcon(iconName)} />
            </IconButton>
            {selectedIcon === iconName && Boolean(anchorEl) && (
              <IconColorPicker
                anchorEl={anchorEl}
                selectedIcon={selectedIcon}
                iconSize={iconSize}
                isMobile={isMobile}
                onPickColor={handleColorPick}
                onClose={() => setAnchorEl(null)}
              />
            )}
          </GridListTile>
        ))}
      </GridList>
    </>
  )
}

IconPicker.propTypes = {
  selectedIcon: PropTypes.string,
  onIconSelect: PropTypes.func.isRequired,
  onIconColorSelect: PropTypes.func,
  scrollContainerRef: PropTypes.shape({ current: PropTypes.any })
}

IconPicker.displayName = 'IconPicker'
