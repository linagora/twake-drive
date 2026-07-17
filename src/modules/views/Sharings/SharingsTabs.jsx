import React from 'react'

import Tab from 'cozy-ui/transpiled/react/Tab'
import Tabs from 'cozy-ui/transpiled/react/Tabs'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'

const TAB_ITEMS = [
  { value: SHARING_TAB_WITH_ME, labelKey: 'toolbar.sharings_tab_with_me' },
  { value: SHARING_TAB_BY_ME, labelKey: 'toolbar.sharings_tab_by_me' },
  { value: SHARING_TAB_DRIVES, labelKey: 'toolbar.sharings_tab_drives' }
]

/**
 * Segmented control switching between the Sharings tabs.
 *
 * Fully controlled: the active tab and changes flow through props; tab
 * values are the SHARING_TAB_* slugs. The Team drives tab presence is
 * decided by the parent through `showDrives` (flag-driven, never
 * data-driven, so an async drives list cannot cause layout shift).
 *
 * Desktop renders the theme's `segmented` pill track (per the Figma
 * mockup, text-only, meant for the header row next to the title). The
 * mobile design is not specified yet, so mobile keeps interim full-width
 * tabs, placed below the header which is hidden on mobile. The segmented
 * variant must not receive textColor/indicatorColor: the theme styles the
 * indicator as the sliding active pill.
 *
 * @param {object} props - Component props
 * @param {string} props.tab - Active SHARING_TAB_* slug
 * @param {(tab: string) => void} props.onChange - Called with the tab slug
 * @param {boolean} props.showDrives - Whether to render the Team drives tab
 * @param {string} [props.className] - Extra class for the Tabs root
 * @returns {JSX.Element} The rendered component
 */
const SharingsTabs = ({ tab, onChange, showDrives = false, className }) => {
  const { isMobile } = useBreakpoints()
  const { t } = useI18n()

  const items = showDrives
    ? TAB_ITEMS
    : TAB_ITEMS.filter(item => item.value !== SHARING_TAB_DRIVES)

  // MUI emits null when re-clicking the active button of an exclusive
  // group and re-fires onChange for the active Tab.
  const handleChange = (_, value) => {
    if (value !== null && value !== tab) {
      onChange(value)
    }
  }

  const variantProps = isMobile
    ? { narrowed: true, textColor: 'primary', indicatorColor: 'primary' }
    : { segmented: true }

  return (
    <Tabs
      value={tab}
      onChange={handleChange}
      aria-label={t('toolbar.sharings_tabs')}
      className={className}
      {...variantProps}
    >
      {items.map(({ value, labelKey }) => (
        <Tab key={value} value={value} label={t(labelKey)} />
      ))}
    </Tabs>
  )
}

export default SharingsTabs
