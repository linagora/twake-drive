import React from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import ListMinIcon from 'cozy-ui/transpiled/react/Icons/ListMin'
import MosaicMinIcon from 'cozy-ui/transpiled/react/Icons/MosaicMin'
import ToggleButton from 'cozy-ui/transpiled/react/ToggleButton'
import ToggleButtonGroup from 'cozy-ui/transpiled/react/ToggleButtonGroup'

import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'

/**
 * ViewSwitcher component for toggling between grid and list views
 * @param {Object} props - Component props
 * @param {string} props.className - Additional CSS class name
 * @returns {JSX.Element} The rendered component
 */
const ViewSwitcher = ({ className }) => {
  const { t } = useI18n()
  const { viewType, switchView } = useViewSwitcherContext()

  // Convert isBigThumbnail to value for ToggleButtonGroup
  const value = viewType

  const handleChange = (event, newValue) => {
    if (newValue !== null) {
      switchView(newValue)
    }
  }

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={handleChange}
      aria-label={t('table.head_view_mode')}
      size="small"
      className={className}
      variant="rounded"
    >
      <ToggleButton
        value="list"
        aria-label={t('table.head_view_list')}
        rounded={true}
        color="default"
      >
        <Icon icon={ListMinIcon} />
      </ToggleButton>
      <ToggleButton
        value="grid"
        aria-label={t('table.head_view_grid')}
        rounded={true}
        color="default"
      >
        <Icon icon={MosaicMinIcon} />
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

export default ViewSwitcher
