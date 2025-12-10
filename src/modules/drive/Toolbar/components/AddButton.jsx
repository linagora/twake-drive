import React, { useContext } from 'react'
import { useI18n } from 'twake-i18n'

import Button from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import PlusIcon from 'cozy-ui/transpiled/react/Icons/Plus'

import { AddMenuContext } from '@/modules/drive/AddMenu/AddMenuProvider'

export const AddButton = ({ className, isPublic }) => {
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
        variant={isPublic ? 'secondary' : 'primary'}
        style={
          isPublic
            ? undefined
            : {
                color: 'var(--primaryTextColor)',
                backgroundColor: 'var(--paperBackgroundColor)'
              }
        }
        disabled={isDisabled || isOffline}
        startIcon={<Icon icon={PlusIcon} />}
        label={t('toolbar.menu_create')}
        onClick={handleToggle}
        {...a11y}
      />
    </div>
  )
}

export default React.memo(AddButton)
