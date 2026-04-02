import React, { useMemo } from 'react'

import { useClient, useQuery } from 'cozy-client'
import { makeSharingLink } from 'cozy-client/dist/models/sharing'
import List from 'cozy-ui/transpiled/react/List'

import { ROOT_DIR_ID } from '@/constants/config'
import { FolderPickerContentLoader } from '@/components/FolderPicker/FolderPickerContentLoader'
import { FolderPickerContentLoadMore } from '@/components/FolderPicker/FolderPickerContentLoadMore'
import { FolderPickerListItem } from '@/components/FolderPicker/FolderPickerListItem'
import { buildMoveOrImportQuery } from '@/queries'

const Picker = ({ service }) => {
  const client = useClient()
  const query = useMemo(() => buildMoveOrImportQuery(ROOT_DIR_ID), [])
  const { fetchStatus, data, hasMore, fetchMore } = useQuery(
    query.definition,
    query.options
  )

  const handleClick = async file => {
    const [shareLinkTTL, shareLinkPermanent] = await Promise.all([
      makeSharingLink(client, [file._id], { ttl: '5m' }),
      makeSharingLink(client, [file._id])
    ])
    service.terminate({ ...file, shareLinkTTL, shareLinkPermanent })
  }

  const files = data || []

  return (
    <List>
      <FolderPickerContentLoader
        fetchStatus={fetchStatus}
        hasNoData={files.length === 0}
      >
        {files.map((file, index) => (
          <FolderPickerListItem
            key={file._id}
            file={file}
            onClick={handleClick}
            showDivider={index !== files.length - 1}
          />
        ))}
        <FolderPickerContentLoadMore hasMore={hasMore} fetchMore={fetchMore} />
      </FolderPickerContentLoader>
    </List>
  )
}

export default Picker
