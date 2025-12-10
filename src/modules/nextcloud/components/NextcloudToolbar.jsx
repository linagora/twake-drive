import cx from 'classnames'
import React, { useState, useRef } from 'react'
import { useI18n } from 'twake-i18n'

import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'
import {
  makeActions,
  divider
} from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import PlusIcon from 'cozy-ui/transpiled/react/Icons/Plus'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'

import { BarRightOnMobile } from '@/components/Bar'
import { MoreMenu } from '@/components/MoreMenu'
import { selectable } from '@/modules/actions/components/selectable'
import { addFolder } from '@/modules/nextcloud/components/actions/addFolder'
import { downloadNextcloudFolder } from '@/modules/nextcloud/components/actions/downloadNextcloudFolder'
import { openWithinNextcloud } from '@/modules/nextcloud/components/actions/openWithinNextcloud'
import { trash } from '@/modules/nextcloud/components/actions/trash'
import { upload } from '@/modules/nextcloud/components/actions/upload'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const NextcloudToolbar = () => {
  const { t } = useI18n()
  const { showSelectionBar } = useSelectionContext()

  /**
   * TODO : Extract this logic to a component that can be reused for other toolbars
   */
  const [isAddMenuOpened, setAddMenuOpened] = useState(false)
  const addButtonRef = useRef(null)
  const toggleAddMenu = () => setAddMenuOpened(!isAddMenuOpened)
  const closeAddMenu = () => setAddMenuOpened(false)
  const addActions = makeActions([addFolder, divider, upload], { t })

  const moreActions = makeActions(
    [selectable, openWithinNextcloud, downloadNextcloudFolder, divider, trash],
    {
      t,
      showSelectionBar
    }
  )

  return (
    <div
      className={cx('u-flex', 'u-flex-items-center', 'u-ml-auto')}
      role="toolbar"
    >
      <Buttons
        disabled
        label={t('NextcloudToolbar.share')}
        variant="secondary"
        startIcon={<Icon icon={ShareIcon} />}
        className="u-mr-half"
      />
      <div ref={addButtonRef}>
        <Buttons
          onClick={toggleAddMenu}
          icon={PlusIcon}
          label={t('toolbar.menu_add')}
          startIcon={<Icon icon={PlusIcon} />}
          aria-controls={isAddMenuOpened ? 'add-menu' : undefined}
          aria-haspopup={true}
          aria-expanded={isAddMenuOpened ? true : undefined}
          className="u-mr-half"
        />
      </div>
      {isAddMenuOpened ? (
        <ActionsMenu
          open
          ref={addButtonRef}
          onClose={closeAddMenu}
          actions={addActions}
          docs={[]}
          anchorOrigin={{
            strategy: 'fixed',
            vertical: 'bottom',
            horizontal: 'right'
          }}
        />
      ) : null}
      <BarRightOnMobile>
        <MoreMenu actions={moreActions} docs={[]} disabled={false} />
      </BarRightOnMobile>
    </div>
  )
}

export { NextcloudToolbar }
