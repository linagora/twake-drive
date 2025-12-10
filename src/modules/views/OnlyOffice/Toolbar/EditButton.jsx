import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient, useQuery, Q, isQueryLoading } from 'cozy-client'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import LightbulbIcon from 'cozy-ui/transpiled/react/Icons/Lightbulb'
import RenameIcon from 'cozy-ui/transpiled/react/Icons/Rename'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

import { DOCTYPE_FILES_SETTINGS } from '@/lib/doctypes'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { canWriteOfficeDocument } from '@/modules/views/OnlyOffice/helpers'
import { getAppSettingQuery } from '@/queries'

const useStyle = makeStyles({
  popper: {
    pointerEvents: 'auto',
    '& .actions-tooltip': {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '0.5rem',
      '& > button': {
        color: 'var(--white)'
      }
    }
  },
  tooltip: {
    backgroundColor: 'var(--primaryColor)'
  },
  arrow: {
    color: 'var(--primaryColor)'
  }
})

const EditButton = ({ openTooltip }) => {
  const classes = useStyle()
  const client = useClient()
  const { t } = useI18n()
  const { editorMode, setEditorMode } = useOnlyOfficeContext()
  const navigate = useNavigate()
  const [showTooltip, setShowTooltip] = useState(true)

  const handleClick = () => {
    if (canWriteOfficeDocument()) {
      setEditorMode(editorMode === 'view' ? 'edit' : 'view')
    } else {
      navigate('./paywall')
    }
  }

  const closeTooltip = () => {
    setShowTooltip(false)
  }

  const handleTooltip = async () => {
    const { data } = await client.query(Q(DOCTYPE_FILES_SETTINGS))
    const settings = data?.[0] || {}
    await client.save({
      ...settings,
      _type: DOCTYPE_FILES_SETTINGS,
      hideOOEditTooltip: true
    })
  }

  return (
    <Tooltip
      open={showTooltip && openTooltip}
      classes={classes}
      title={
        <>
          <div className="u-flex u-flex-items-center u-mb-half">
            <Icon icon={LightbulbIcon} className="u-mr-half" />
            <Typography variant="h6" color="inherit">
              {t('OnlyOffice.tooltip.title')}
            </Typography>
          </div>
          <Typography variant="body2" color="inherit">
            {t('OnlyOffice.tooltip.text')}
          </Typography>
          <div className="actions-tooltip">
            <Buttons
              onClick={handleTooltip}
              variant="text"
              label={t('OnlyOffice.tooltip.actions.hide')}
            />
            <Buttons
              onClick={closeTooltip}
              variant="text"
              label={t('OnlyOffice.tooltip.actions.ok')}
            />
          </div>
        </>
      }
    >
      <Buttons
        className="u-ml-half"
        onClick={handleClick}
        disabled={editorMode === 'edit'}
        startIcon={<Icon icon={RenameIcon} />}
        label={t('OnlyOffice.actions.edit')}
      />
    </Tooltip>
  )
}

const EditButtonWithQuery = () => {
  const { isEditorModeView } = useOnlyOfficeContext()

  const { data: settings, ...appSettingsQueryResult } = useQuery(
    getAppSettingQuery.definition,
    getAppSettingQuery.options
  )
  const hideOOEditTooltip = settings?.[0]?.hideOOEditTooltip
  const openTooltip = isQueryLoading(appSettingsQueryResult)
    ? false
    : !hideOOEditTooltip && isEditorModeView && canWriteOfficeDocument()

  return <EditButton openTooltip={openTooltip} />
}

const EditButtonWrapper = () => {
  const { isPublic } = useOnlyOfficeContext()

  if (isPublic) {
    return <EditButtonWithQuery />
  }

  return <EditButton openTooltip={false} />
}

export default EditButtonWrapper
