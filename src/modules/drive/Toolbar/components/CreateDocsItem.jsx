import get from 'lodash/get'
import React from 'react'
import { useI18n } from 'twake-i18n'

import { useClient, generateWebLink, useCapabilities } from 'cozy-client'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import IconDocs from '@/assets/icons/icon-docs.svg'
import { displayedFolderOrRootFolder } from '@/hooks/helpers'

const CreateDocsItem = ({ displayedFolder, isReadOnly, onClick }) => {
  const client = useClient()
  const { t } = useI18n()

  const { capabilities } = useCapabilities(client)
  const isFlatDomain = get(capabilities, 'flat_subdomains')
  const { showAlert } = useAlert()

  const _displayedFolder = displayedFolderOrRootFolder(displayedFolder)

  const handleClick = async () => {
    if (isReadOnly) {
      showAlert({
        message: t(
          'AddMenu.readOnlyFolder',
          'This is a read-only folder. You cannot perform this action.'
        ),
        severity: 'warning'
      })
      onClick()
      return
    }

    const url = generateWebLink({
      slug: 'docs',
      cozyUrl: client.getStackClient().uri,
      subDomainType: isFlatDomain ? 'flat' : 'nested',
      pathname: '',
      hash: `/bridge/docs/new/${_displayedFolder._id}`
    })

    window.location.href = url
  }

  return (
    <ActionsMenuItem onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={IconDocs} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_create_docs')} />
    </ActionsMenuItem>
  )
}

export default CreateDocsItem
