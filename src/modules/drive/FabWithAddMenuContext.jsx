import { Plus } from '@linagora/twake-icons'
import React, { useContext } from 'react'

import { ExtendableFab } from 'cozy-ui/transpiled/react/Fab'
import { useI18n } from 'twake-i18n'

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
        icon={Plus}
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
