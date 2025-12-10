import React from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'

import { moveNextcloud } from './actions/moveNextcloud'

import { useClipboardContext } from '@/contexts/ClipboardProvider'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { hr } from '@/modules/actions'
import { duplicateTo } from '@/modules/actions/components/duplicateTo'
import { FolderBody } from '@/modules/folder/components/FolderBody'
import { deleteNextcloudFile } from '@/modules/nextcloud/components/actions/deleteNextcloudFile'
import { downloadNextcloudFile } from '@/modules/nextcloud/components/actions/downloadNextcloudFile'
import { openWithinNextcloud } from '@/modules/nextcloud/components/actions/openWithinNextcloud'
import { rename } from '@/modules/nextcloud/components/actions/rename'
import { shareNextcloudFile } from '@/modules/nextcloud/components/actions/shareNextcloudFile'

const NextcloudFolderBody = ({ path, queryResults }) => {
  const [searchParams] = useSearchParams()
  const client = useClient()
  const { t } = useI18n()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { hasClipboardData } = useClipboardContext()

  const allItems =
    queryResults?.reduce((acc, result) => {
      if (result.data) {
        acc.push(...result.data)
      }
      return acc
    }, []) || []

  useKeyboardShortcuts({
    onPaste: () => {},
    canPaste: hasClipboardData,
    client,
    items: allItems,
    sharingContext: null,
    allowCopy: true,
    isNextCloudFolder: true
  })

  const fileActions = makeActions(
    [
      shareNextcloudFile,
      downloadNextcloudFile,
      hr,
      rename,
      moveNextcloud,
      duplicateTo,
      openWithinNextcloud,
      hr,
      deleteNextcloudFile
    ],
    {
      t,
      client,
      pathname,
      navigate,
      search: searchParams.toString()
    }
  )

  return (
    <FolderBody
      folderId={path}
      queryResults={queryResults}
      actions={fileActions}
      withFilePath={false}
    />
  )
}

export { NextcloudFolderBody }
