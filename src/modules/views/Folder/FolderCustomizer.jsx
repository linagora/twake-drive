import React, { useState, useRef } from 'react'
import { useI18n } from 'twake-i18n'

import { useClient, useQuery } from 'cozy-client'
import Backdrop from 'cozy-ui/transpiled/react/Backdrop'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Grid from 'cozy-ui/transpiled/react/Grid'
import { Spinner } from 'cozy-ui/transpiled/react/Spinner'
import Tab from 'cozy-ui/transpiled/react/Tab'
import Tabs from 'cozy-ui/transpiled/react/Tabs'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { CustomizedIcon } from './CustomizedIcon'

import styles from '@/styles/folder-customizer.styl'

import { ColorPicker } from '@/components/ColorPicker/ColorPicker'
import { COLORS } from '@/components/ColorPicker/constants'
import { IconPicker } from '@/components/IconPicker/index.jsx'
import { addRecentIcon } from '@/hooks'
import logger from '@/lib/logger'
import {
  buildFileOrFolderByIdQuery,
  buildSharedDriveFileOrFolderByIdQuery
} from '@/queries'

export const FolderCustomizerModal = ({ folderId, driveId, onClose }) => {
  const folderQuery = driveId
    ? buildSharedDriveFileOrFolderByIdQuery({ fileId: folderId, driveId })
    : buildFileOrFolderByIdQuery(folderId)
  const result = useQuery(folderQuery.definition, folderQuery.options)
  const { fetchStatus, data: folder } = result

  return fetchStatus !== 'loaded' ? (
    <Backdrop isOver open>
      <Spinner size="xxlarge" middle noMargin color="var(--white)" />
    </Backdrop>
  ) : (
    <DumbFolderCustomizer folder={folder} driveId={driveId} onClose={onClose} />
  )
}

FolderCustomizerModal.displayName = 'FolderCustomizerModal'

const DumbFolderCustomizer = ({ folder, driveId, onClose }) => {
  const { t } = useI18n()
  const tabItems = ['colors', 'icons']
  const [selectedColor, setSelectedColor] = useState(
    folder.metadata?.decorations?.color || COLORS[8]
  )
  const [selectedIcon, setSelectedIcon] = useState(
    folder.metadata?.decorations?.icon || null
  )
  const [selectedIconColor, setSelectedIconColor] = useState(
    folder.metadata?.decorations?.icon_color
  )
  const { showAlert } = useAlert()
  const client = useClient()

  const handleColorSelect = color => {
    setSelectedColor(color)
  }
  const handleIconSelect = iconName => {
    setSelectedIcon(iconName)
  }
  const handleIconColorSelect = color => {
    setSelectedIconColor(color)
  }

  const handleApply = async () => {
    try {
      // Prepare decorations object
      const decorations = {
        ...folder.metadata?.decorations,
        color: selectedColor
      }

      // Only add icon and icon_color if an actual icon is selected (not "none")
      if (selectedIcon && selectedIcon !== 'none') {
        decorations.icon = selectedIcon
        if (selectedIconColor) {
          decorations.icon_color = selectedIconColor
        }
      } else {
        delete decorations.icon
        delete decorations.icon_color
      }

      if (driveId) {
        await client.collection('io.cozy.files', { driveId }).update({
          ...folder,
          metadata: {
            ...folder.metadata,
            decorations
          }
        })
      } else {
        await client.save({
          ...folder,
          metadata: {
            ...folder.metadata,
            decorations
          }
        })
      }

      if (selectedIcon && selectedIcon !== 'none') {
        addRecentIcon(selectedIcon)
      }
    } catch (error) {
      logger.error(`Error while updating folder decoration`, error)
      showAlert({
        message: t('FolderCustomizer.error'),
        severity: 'error'
      })
    } finally {
      onClose()
    }
  }
  const [selectedTab, setSelectedTab] = useState(0)
  const iconContainerRef = useRef(null)

  const handleTabChange = (_, newValue) => {
    setSelectedTab(newValue)
  }

  return (
    <FixedDialog
      size="small"
      onClose={onClose}
      open={true}
      title={t('FolderCustomizer.title')}
      content={
        <Grid
          container
          wrap="nowrap"
          direction="column"
          className={`u-h-100 ${styles['foldercustomizer-dialog']}`}
        >
          <Grid item className="u-mb-1 u-ta-center">
            <CustomizedIcon
              selectedColor={selectedColor}
              selectedIcon={selectedIcon}
              selectedIconColor={selectedIconColor}
              size={52}
            />
          </Grid>

          <Grid container item justifyContent="center" className="u-mb-1">
            <Tabs
              narrowed
              value={selectedTab}
              textColor="primary"
              indicatorColor="primary"
              onChange={handleTabChange}
            >
              {tabItems.map(tabItem => (
                <Tab
                  label={t(`FolderCustomizer.tabs.${tabItem}`)}
                  key={tabItem}
                />
              ))}
            </Tabs>
          </Grid>

          <Grid
            item
            container
            justifyContent="center"
            direction="column"
            className={styles['foldercustomizer-tabs-container']}
          >
            {tabItems[selectedTab] === 'colors' && (
              <Grid item className="u-ta-center u-mt-3-t">
                <Typography
                  variant="h6"
                  className="u-mt-1 u-mb-1-t u-mb-1-half"
                >
                  {t('FolderCustomizer.description')}
                </Typography>
                <ColorPicker
                  selectedColor={selectedColor}
                  onColorSelect={handleColorSelect}
                />
              </Grid>
            )}
            {tabItems[selectedTab] === 'icons' && (
              <Grid
                item
                ref={iconContainerRef}
                className={styles['foldercustomizer-icons-container']}
              >
                <IconPicker
                  selectedIcon={selectedIcon}
                  onIconSelect={handleIconSelect}
                  onIconColorSelect={handleIconColorSelect}
                  scrollContainerRef={iconContainerRef}
                />
              </Grid>
            )}
          </Grid>
        </Grid>
      }
      actions={
        <>
          <Buttons
            label={t('FolderCustomizer.cancel')}
            onClick={onClose}
            variant="secondary"
          />
          <Buttons label={t('FolderCustomizer.apply')} onClick={handleApply} />
        </>
      }
    />
  )
}
