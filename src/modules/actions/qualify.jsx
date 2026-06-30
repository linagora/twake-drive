import { Icon, LabelOutlined, Qualify } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import { getQualification } from 'cozy-client/dist/models/document'
import { getBoundT } from 'cozy-client/dist/models/document/locales'
import { isFile } from 'cozy-client/dist/models/file'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModal } from '@/modules/actions/helpers'

const makeComponent = ({ label, scannerT, t }) => {
  const Component = forwardRef((props, ref) => {
    const file = props.docs[0]
    const fileQualif = getQualification(file)

    return (
      <ActionsMenuItem {...props} ref={ref}>
        <ListItemIcon>
          <Icon icon={fileQualif ? Qualify : LabelOutlined} />
        </ListItemIcon>
        <ListItemText primary={fileQualif ? t('Scan.requalify') : label} />
        {fileQualif && (
          <ListItemText
            secondary={scannerT(`Scan.items.${fileQualif.label}`)}
            secondaryTypographyProps={{ variant: 'caption' }}
            className="u-ta-right"
          />
        )}
      </ActionsMenuItem>
    )
  })
  Component.displayName = 'Qualify'

  return Component
}

export const qualify = ({ t, lang, navigate, pathname }) => {
  const label = t('SelectionBar.qualify')
  const scannerT = getBoundT(lang || 'en')

  return {
    name: 'qualify',
    label,
    icon: Qualify,
    displayCondition: selection => {
      return selection.length === 1 && isFile(selection[0])
    },
    action: files => {
      return navigateToModal({ navigate, pathname, files, path: 'qualify' })
    },
    Component: makeComponent({ label, scannerT, t })
  }
}
