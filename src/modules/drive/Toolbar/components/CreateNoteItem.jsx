import get from 'lodash/get'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { translate } from 'twake-i18n'

import {
  withClient,
  generateWebLink,
  models,
  useAppLinkWithStoreFallback,
  useCapabilities
} from 'cozy-client'
import { isFlagshipApp } from 'cozy-device-helper'
import flag from 'cozy-flags'
import { useWebviewIntent } from 'cozy-intent'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconNote from 'cozy-ui/transpiled/react/Icons/FileTypeNote'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { generateUniversalLink } from 'cozy-ui-plus/dist/AppLinker/native'

import { displayedFolderOrRootFolder } from '@/hooks/helpers'

const CreateNoteItem = ({
  client,
  t,
  displayedFolder,
  isReadOnly,
  onClick
}) => {
  const { capabilities } = useCapabilities(client)
  const isFlatDomain = get(capabilities, 'flat_subdomains')
  const webviewIntent = useWebviewIntent()
  const { showAlert } = useAlert()
  const navigate = useNavigate()

  const _displayedFolder = displayedFolderOrRootFolder(displayedFolder)
  const { driveId, id: folderId } = _displayedFolder

  const { fetchStatus, url, isInstalled } = useAppLinkWithStoreFallback(
    'notes',
    client
  )

  if (fetchStatus !== 'loaded' || !isInstalled) {
    return null
  }

  const notesAppUrl = url

  let returnUrl = ''
  if (
    (isFlagshipApp() && webviewIntent) ||
    flag('cozy.universal-link.disabled') === true
  ) {
    returnUrl = generateWebLink({
      slug: 'drive',
      cozyUrl: client.getStackClient().uri,
      subDomainType: isFlatDomain ? 'flat' : 'nested',
      pathname: '',
      hash: `/files/${folderId}`
    })
  } else {
    returnUrl = generateUniversalLink({
      slug: 'drive',
      cozyUrl: client.getStackClient().uri,
      subDomainType: isFlatDomain ? 'flat' : 'nested',
      nativePath: driveId
        ? `/shareddrive/${driveId}/files/${folderId}`
        : `/files/${folderId}`
    })
  }

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

    if (notesAppUrl === undefined) return

    const { data: file } = await client
      .collection('io.cozy.notes', { driveId })
      .create({
        dir_id: folderId
      })

    if (driveId) {
      navigate(`/note/${driveId}/${file.id}`)
      return
    }

    const privateUrl = await models.note.generatePrivateUrl(notesAppUrl, file, {
      returnUrl
    })

    /**
     * Not using AppLinker here because it would require too much refactoring and would be risky
     * Instead we use the webviewIntent programmatically to open the cozy-note app on the note href
     */
    if (isFlagshipApp() && webviewIntent)
      return webviewIntent.call('openApp', privateUrl, { slug: 'notes' })

    window.location.href = privateUrl
  }

  return (
    <ActionsMenuItem data-testid="create-a-note" onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={IconNote} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_create_note')} />
    </ActionsMenuItem>
  )
}

export default translate()(withClient(CreateNoteItem))
