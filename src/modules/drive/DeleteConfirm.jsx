import React, { useCallback, useEffect, useState } from 'react'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { splitFilename } from 'cozy-client/dist/models/file'
import { SharedDocument, SharedRecipientsList } from 'cozy-sharing'
import Button from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Icon from 'cozy-ui/transpiled/react/Icon'
import Stack from 'cozy-ui/transpiled/react/Stack'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { useSelectionContext } from '../selection/SelectionProvider'

import { DOCTYPE_ALBUMS } from '@/lib/doctypes'
import { getEntriesTypeTranslated } from '@/lib/entries'
import { trashFiles } from '@/modules/actions/utils'
import { buildAlbumByIdQuery } from '@/queries'

const Message = ({ type, fileCount }) => {
  const icon =
    type === 'referenced' ? 'album' : type.includes('share') ? 'people' : type

  const { t } = useI18n()
  return (
    <div className="u-flex u-flex-items-center">
      <Icon
        icon={icon}
        className="u-flex-shrink-0"
        color="var(--iconTextColor)"
      />
      <Typography className="u-pl-1-half">
        {t(`DeleteConfirm.${type}`, fileCount)}
      </Typography>
    </div>
  )
}

export const DeleteConfirm = ({
  files,
  afterConfirmation,
  onClose,
  children,
  driveId
}) => {
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const fileCount = files.length
  const client = useClient()
  const [isDeleting, setDeleting] = useState(false)
  const [isReferencedByManualAlbum, setIsReferencedByManualAlbum] =
    useState(false)
  const { setSelectedItems } = useSelectionContext()

  useEffect(() => {
    const fetchAlbums = async () => {
      const albumIdsFromFiles = files.flatMap(file =>
        (
          (file &&
            file.relationships &&
            file.relationships.referenced_by &&
            file.relationships.referenced_by.data) ||
          []
        )
          .filter(reference => reference.type === DOCTYPE_ALBUMS)
          .map(reference => reference.id)
      )

      const albums = await Promise.all(
        albumIdsFromFiles.map(albumId => {
          const albumByIdQuery = buildAlbumByIdQuery(albumId)
          return client.fetchQueryAndGetFromState({
            definition: albumByIdQuery.definition(),
            options: albumByIdQuery.options
          })
        })
      )

      setIsReferencedByManualAlbum(
        !!albums.filter(album => album && album.data && !album.data.auto).length
      )
    }
    fetchAlbums()
  }, [client, files])

  const onDelete = useCallback(async () => {
    // Prevent double executions
    if (isDeleting) return

    setDeleting(true)
    showAlert({ message: t('alert.trash_file_processing'), severity: 'info' })
    onClose()
    await trashFiles(client, files, { showAlert, t, driveId })
    afterConfirmation()
    setSelectedItems(prevSelectedItems => {
      const fileIdsToRemove = files.map(file => file.id)
      return Object.fromEntries(
        Object.entries(prevSelectedItems).filter(
          ([id]) => !fileIdsToRemove.includes(id)
        )
      )
    })
  }, [
    client,
    files,
    afterConfirmation,
    onClose,
    showAlert,
    t,
    setSelectedItems,
    driveId,
    isDeleting
  ])

  const entriesType = getEntriesTypeTranslated(t, files)

  return (
    <ConfirmDialog
      open={true}
      onClose={onClose}
      title={t('DeleteConfirm.title', {
        filename: splitFilename(files[0]).filename,
        smart_count: fileCount,
        type: entriesType
      })}
      content={
        <Stack>
          <Message type="trash" fileCount={fileCount} />
          <Message type="restore" fileCount={fileCount} />
          {isReferencedByManualAlbum && (
            <Message type="referenced" fileCount={fileCount} />
          )}
          {children}
        </Stack>
      }
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            label={t('DeleteConfirm.cancel')}
          />
          <Button
            variant="primary"
            onClick={onDelete}
            label={t('DeleteConfirm.delete')}
            color="error"
            busy={isDeleting}
          />
        </>
      }
    />
  )
}

const DeleteConfirmWithSharingContext = ({ files, ...rest }) =>
  files.length !== 1 ? (
    <DeleteConfirm files={files} {...rest} />
  ) : (
    <SharedDocument docId={files[0].id}>
      {({ isSharedByMe, link, recipients }) => {
        const statuses = recipients
          .map(recipient => recipient.status)
          .filter(status => status !== 'owner')

        const isStatusesEqual = statuses.reduce((acc, current) => {
          return acc && current === statuses[0]
        }, true)

        let shareMessageType = !isStatusesEqual
          ? 'share_both'
          : statuses[0] === 'ready'
          ? 'share_accepted'
          : 'share_waiting'

        return (
          <DeleteConfirm files={files} {...rest}>
            {isSharedByMe && link ? (
              <Message type="link" fileCount={files.length} />
            ) : null}
            {isSharedByMe && statuses.length > 0 ? (
              <Message type={shareMessageType} fileCount={files.length} />
            ) : null}
            {isSharedByMe && recipients.length > 0 ? (
              <SharedRecipientsList
                className="u-ml-2-half"
                docId={files[0].id}
              />
            ) : null}
          </DeleteConfirm>
        )
      }}
    </SharedDocument>
  )

export default DeleteConfirmWithSharingContext
