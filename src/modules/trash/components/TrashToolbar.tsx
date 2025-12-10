import cx from 'classnames'
import React, { FC } from 'react'
import { useNavigate } from 'react-router-dom'

import { BarRight } from 'cozy-bar'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import TrashIcon from 'cozy-ui/transpiled/react/Icons/Trash'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { MoreMenu } from '@/components/MoreMenu'
import { selectable } from '@/modules/actions/components/selectable'
import SearchButton from '@/modules/drive/Toolbar/components/SearchButton'
import ViewSwitcher from '@/modules/drive/Toolbar/components/ViewSwitcher'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { emptyTrash } from '@/modules/trash/components/actions/emptyTrash'

const TrashToolbar: FC = () => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const navigate = useNavigate()

  const { showSelectionBar, isSelectionBarVisible } = useSelectionContext()

  const handleEmptyTrash = (): void => {
    navigate('empty')
  }

  const actions = makeActions([selectable, emptyTrash], {
    t,
    showSelectionBar,
    navigate
  })

  if (isMobile) {
    return (
      <BarRight>
        <SearchButton />
        <MoreMenu actions={actions} docs={[]} />
      </BarRight>
    )
  }

  return (
    <div
      className={cx('u-flex', 'u-flex-items-center', 'u-ml-auto')}
      role="toolbar"
    >
      <ViewSwitcher className="u-mr-half" />
      <Button
        variant="secondary"
        color="error"
        onClick={handleEmptyTrash}
        disabled={isSelectionBarVisible}
        startIcon={<Icon icon={TrashIcon} />}
        label={t('TrashToolbar.emptyTrash')}
      />
    </div>
  )
}

export { TrashToolbar }
