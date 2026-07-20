import React from 'react'

import ColorPickerCustom from 'cozy-ui/transpiled/react/ColorPickerCustom'
import Popover from 'cozy-ui/transpiled/react/Popover'

const FolderCustomColorPicker = ({ anchorEl, color, onSave, onClose }) => {
  return (
    <Popover
      id="simple-menu"
      classes={{ paper: 'u-p-1' }}
      PaperProps={{
        style: { width: '100%', maxWidth: 246 }
      }}
      anchorEl={anchorEl}
      getContentAnchorEl={null}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right'
      }}
      keepMounted
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <ColorPickerCustom
        color={color}
        onCancel={onClose}
        onSave={customColor => onSave(customColor)}
      />
    </Popover>
  )
}

export default FolderCustomColorPicker
