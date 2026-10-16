import React from 'react'
import { Link } from 'react-router-dom'

import flag from 'cozy-flags'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Storage from 'cozy-ui-plus/dist/Storage'
import { useI18n } from 'twake-i18n'

import ButtonClient from '@/components/pushClient/Button'

export function LayoutSidebarFooter() {
  const { t } = useI18n()
  return (
    <div>
      {flag('drive.file-picker-demo.enabled') && (
        <div className="u-p-1-half">
          <Button
            component={Link}
            role="link"
            to="/file-picker-demo"
            variant="secondary"
            label={t('FilePickerDemo.title')}
          />
        </div>
      )}
      {flag('drive.move-intent-demo.enabled') && (
        <div className="u-p-1-half">
          <Button
            component={Link}
            role="link"
            to="/move-intent-demo"
            variant="secondary"
            label={t('MoveIntentDemo.title')}
          />
        </div>
      )}
      <div className="u-p-1-half">
        <Storage />
      </div>
      <ButtonClient />
    </div>
  )
}
