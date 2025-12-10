import React from 'react'
import { useI18n } from 'twake-i18n'

import logger from 'cozy-logger'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CameraIcon from 'cozy-ui/transpiled/react/Icons/Camera'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { useScannerContext } from '@/modules/drive/Toolbar/components/Scanner/ScannerProvider'

const log = logger.namespace('Toolbar/components/Scanner/ScannerMenuItem')

/**
 * Renders a scanner menu item.
 * @returns The JSX element representing the scanner menu item.
 */
interface ScannerMenuItemProps {
  onClick: () => void
}

export const ScannerMenuItem = ({
  onClick
}: ScannerMenuItemProps): JSX.Element | null => {
  const { t } = useI18n()
  const { hasScanner, startScanner } = useScannerContext()

  const handleClick = (): void => {
    if (startScanner) {
      startScanner().catch((error: Error) => {
        log('error', `Failed to start scanner: ${error.message}`)
      })
    }
    onClick()
  }

  return hasScanner ? (
    <ActionsMenuItem onClick={handleClick} data-testid="scan-doc">
      <ListItemIcon>
        <Icon icon={CameraIcon} />
      </ListItemIcon>
      <ListItemText primary={t('Scan.scan_a_doc')} />
    </ActionsMenuItem>
  ) : null
}
