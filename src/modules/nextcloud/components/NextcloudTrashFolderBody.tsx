import React, { FC } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { UseQueryReturnValue } from 'cozy-client/types/types'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { FolderBody } from '@/modules/folder/components/FolderBody'
import { restoreNextcloudFile } from '@/modules/nextcloud/components/actions/restoreNextcloudFile'
import { destroy } from '@/modules/trash/components/actions/destroy'

interface NextcloudTrashFolderBodyProps {
  path: string
  queryResults: UseQueryReturnValue[]
}

const NextcloudTrashFolderBody: FC<NextcloudTrashFolderBodyProps> = ({
  path,
  queryResults
}) => {
  const [searchParams] = useSearchParams()
  const client = useClient()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const fileActions = makeActions([restoreNextcloudFile, destroy], {
    t,
    client,
    showAlert,
    pathname,
    navigate,
    search: searchParams.toString()
  })

  return (
    <FolderBody
      folderId={path}
      queryResults={queryResults}
      actions={fileActions}
      withFilePath={false}
      extraColumns={[]}
    />
  )
}

export { NextcloudTrashFolderBody }
