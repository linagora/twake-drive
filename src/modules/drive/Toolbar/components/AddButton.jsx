import { Icon, Plus } from '@linagora/twake-icons'
import React, { useContext } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { useI18n } from 'twake-i18n'

import { AddMenuContext } from '@/modules/drive/AddMenu/AddMenuProvider'

export const AddButton = ({ className }) => {
  const { t } = useI18n()
  const {
    anchorRef,
    handleToggle,
    isDisabled,
    handleOfflineClick,
    isOffline,
    a11y
  } = useContext(AddMenuContext)

  return (
    <div ref={anchorRef} onClick={isOffline ? handleOfflineClick : undefined}>
      <Button
        className={className}
        variant="primary"
        disabled={isDisabled || isOffline}
        startIcon={<Icon icon={Plus} size={12} />}
        label={t('toolbar.menu_create')}
        onClick={handleToggle}
        {...a11y}
      />
    </div>
  )
}

export default React.memo(AddButton)
