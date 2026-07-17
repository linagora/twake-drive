import React from 'react'

import SharingsTabs from './SharingsTabs'
import FolderViewHeader from '../Folder/FolderViewHeader'

import styles from '@/styles/topbar.styl'

import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import Toolbar from '@/modules/drive/Toolbar'

/**
 * Sharings view header: title, tabs and toolbar.
 *
 * The tabs live inside the header row on desktop (next to the title, per
 * the mockup) and below the header on mobile, where the header itself is
 * hidden.
 *
 * @param {object} props - Component props
 * @param {string} props.title - Page title shown as the single breadcrumb
 * @param {boolean} props.isMobile - Current breakpoint
 * @param {string} props.tab - Active SHARING_TAB_* slug
 * @param {(tab: string) => void} props.onChange - Called with the tab slug
 * @param {boolean} props.showDrives - Whether to render the Team drives tab
 * @returns {JSX.Element} The rendered component
 */
const SharingsHeader = ({ title, isMobile, tab, onChange, showDrives }) => (
  <>
    <FolderViewHeader>
      {/* Keeps the title at its content width so the tabs sit right next
          to it, as in the mockup (see topbar.styl). */}
      <div className={styles['fil-sharings-title']}>
        <Breadcrumb path={[{ name: title }]} />
      </div>
      {!isMobile && (
        <SharingsTabs
          tab={tab}
          onChange={onChange}
          showDrives={showDrives}
          className="u-ml-2"
        />
      )}
      <Toolbar canUpload={false} canCreateFolder={false} />
    </FolderViewHeader>
    {isMobile && (
      <SharingsTabs tab={tab} onChange={onChange} showDrives={showDrives} />
    )}
  </>
)

export default SharingsHeader
