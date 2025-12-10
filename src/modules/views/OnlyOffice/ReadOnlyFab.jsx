import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import Fab from 'cozy-ui/transpiled/react/Fab'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CheckIcon from 'cozy-ui/transpiled/react/Icons/Check'
import RenameIcon from 'cozy-ui/transpiled/react/Icons/Rename'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useFabStyles } from '@/modules/drive/helpers'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { canWriteOfficeDocument } from '@/modules/views/OnlyOffice/helpers'

const ReadOnlyFab = () => {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()

  const { isEditorModeView, editorMode, setEditorMode } = useOnlyOfficeContext()

  const handleClick = useCallback(() => {
    if (canWriteOfficeDocument()) {
      setEditorMode(editorMode === 'view' ? 'edit' : 'view')
    } else {
      navigate('./paywall')
    }
  }, [editorMode, setEditorMode, navigate])

  const label = isEditorModeView
    ? t('OnlyOffice.actions.edit')
    : t('OnlyOffice.actions.validate')

  const fabProps = isMobile ? { 'aria-label': label } : { variant: 'extended' }

  const styles = useFabStyles({
    right: isMobile ? '1rem' : '30px',
    bottom: isMobile ? '1rem' : '55px'
  })

  return (
    <Fab
      className={styles.root}
      color="primary"
      onClick={handleClick}
      {...fabProps}
    >
      <Icon
        icon={isEditorModeView ? RenameIcon : CheckIcon}
        className={!isMobile ? 'u-mr-half' : ''}
        aria-hidden="true"
      />
      {!isMobile && label}
    </Fab>
  )
}

export default React.memo(ReadOnlyFab)
