import React, { useContext } from 'react'
import { useI18n } from 'twake-i18n'

import { ExtendableFab } from 'cozy-ui/transpiled/react/Fab'
import PlusIcon from 'cozy-ui/transpiled/react/Icons/Plus'

import { AddMenuContext } from '@/modules/drive/AddMenu/AddMenuProvider'
import { useFabStyles } from '@/modules/drive/helpers'

const FabWithAddMenuContext = ({ noSidebar }) => {
  const { t } = useI18n()

  const {
    anchorRef,
    handleToggle,
    isDisabled,
    handleOfflineClick,
    isOffline,
    a11y
  } = useContext(AddMenuContext)

  const styles = useFabStyles({
    bottom: noSidebar ? '1rem' : 'calc(var(--sidebarHeight) + 2rem)'
  })

  return (
    <div onClick={isOffline ? handleOfflineClick : undefined}>
      <ExtendableFab
        ref={anchorRef ? anchorRef : undefined}
        color="primary"
        label={t('button.create')}
        icon={PlusIcon}
        className={styles.root}
        disabled={isDisabled || isOffline}
        follow={window}
        onClick={handleToggle}
        {...a11y}
      />
    </div>
  )
}

export default React.memo(FabWithAddMenuContext)
