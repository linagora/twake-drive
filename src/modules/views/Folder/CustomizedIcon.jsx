import React from 'react'

import Icon from 'cozy-ui/transpiled/react/Icon'
import IconStack from 'cozy-ui/transpiled/react/IconStack'

import ColoredFolder from './ColoredFolder'

import { getIcon } from '@/components/IconPicker/IconIndex'

export const CustomizedIcon = ({
  selectedColor = '#46a2ff',
  selectedIcon,
  selectedIconColor,
  size
}) => {
  return (
    <div>
      <IconStack
        offset={{ vertical: '3%' }}
        backgroundIcon={
          <div
            className="u-pos-relative u-dib"
            style={{
              width: size,
              height: size
            }}
          >
            <ColoredFolder
              color={selectedColor}
              width={size || 32}
              height={size || 32}
            />
          </div>
        }
        foregroundIcon={
          <Icon
            icon={getIcon(selectedIcon)}
            color={selectedIconColor}
            size={size / 2.5 || 16}
          />
        }
      />
    </div>
  )
}
