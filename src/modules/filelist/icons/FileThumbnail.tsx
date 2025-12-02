import React from 'react'

import { isReferencedBy, models } from 'cozy-client'
import { isDirectory } from 'cozy-client/dist/models/file'
import { SharedBadge, SharingOwnerAvatar } from 'cozy-sharing'
import Box from 'cozy-ui/transpiled/react/Box'
import GhostFileBadge from 'cozy-ui/transpiled/react/GhostFileBadge'
import Icon from 'cozy-ui/transpiled/react/Icon'
import FileTypeServerIcon from 'cozy-ui/transpiled/react/Icons/FileTypeServer'
import FileTypeSharedDriveIcon from 'cozy-ui/transpiled/react/Icons/FileTypeSharedDrive'
import LinkIcon from 'cozy-ui/transpiled/react/Icons/Link'
import TrashDuotoneIcon from 'cozy-ui/transpiled/react/Icons/TrashDuotone'
import InfosBadge from 'cozy-ui/transpiled/react/InfosBadge'
import Spinner from 'cozy-ui/transpiled/react/Spinner'

import styles from '@/styles/filelist.styl'

import type { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import { DOCTYPE_KONNECTORS } from '@/lib/doctypes'
import { BadgeKonnector } from '@/modules/filelist/icons/BadgeKonnector'
import FileIcon from '@/modules/filelist/icons/FileIcon'
import FileIconMime from '@/modules/filelist/icons/FileIconMime'
import { SharingShortcutIcon } from '@/modules/filelist/icons/SharingShortcutIcon'
import {
  isNextcloudShortcut,
  isNextcloudFile
} from '@/modules/nextcloud/helpers'
import { isSharedDriveFolder } from '@/modules/shareddrives/helpers'

interface FileThumbnailProps {
  file: File | FolderPickerEntry
  size?: number
  isInSyncFromSharing?: boolean
  isEncrypted?: boolean
  showSharedBadge?: boolean
  componentsProps?: {
    sharedBadge?: object
  }
}

const FileThumbnail: React.FC<FileThumbnailProps> = ({
  file,
  size,
  isInSyncFromSharing,
  isEncrypted,
  showSharedBadge = false,
  componentsProps = {
    sharedBadge: {}
  }
}) => {
  const { viewType } = useViewSwitcherContext()

  if (isNextcloudFile(file)) {
    return <FileIconMime file={file} size={size} />
  }

  if (file._id?.endsWith('.trash-dir')) {
    return size && size >= 48 ? (
      <Box
        className="u-flex u-flex-items-center u-flex-justify-center u-bdrs-4"
        width={size}
        height={size}
        bgcolor="var(--contrastBackgroundColor)"
      >
        <Icon icon={TrashDuotoneIcon} size={48} />
      </Box>
    ) : (
      <Icon icon={TrashDuotoneIcon} size={size ?? 32} />
    )
  }

  if (
    file._id === 'io.cozy.files.shared-drives-dir' ||
    isSharedDriveFolder(file)
  ) {
    return (
      <Icon
        className="u-mr-half"
        icon={FileTypeSharedDriveIcon}
        size={size ?? 32}
      />
    )
  }

  if (isNextcloudShortcut(file)) {
    return (
      <Icon className="u-mr-half" icon={FileTypeServerIcon} size={size ?? 32} />
    )
  }

  const isSharingShortcut =
    models.file.isSharingShortcut(file) && !isInSyncFromSharing
  const isRegularShortcut =
    !isSharingShortcut && file.class === 'shortcut' && !isInSyncFromSharing
  const isSimpleFile =
    !isSharingShortcut && !isRegularShortcut && !isInSyncFromSharing
  const isFolder = isSimpleFile && isDirectory(file)
  const isKonnectorFolder = isReferencedBy(file, DOCTYPE_KONNECTORS)

  if (isFolder) {
    if (size && size >= 48) {
      return (
        <Box
          className="u-flex u-flex-items-center u-flex-justify-center u-bdrs-4"
          width={size}
          height={size}
          bgcolor={viewType === 'list' ? 'var(--contrastBackgroundColor)' : ''}
        >
          {isKonnectorFolder ? (
            <BadgeKonnector file={file}>
              <FileIcon
                file={file}
                size={size}
                isEncrypted={isEncrypted}
                viewType={viewType}
              />
              {file.class !== 'shortcut' &&
                showSharedBadge &&
                viewType === 'grid' && (
                  <SharedBadge
                    docId={file._id}
                    {...componentsProps.sharedBadge}
                    small
                  />
                )}
            </BadgeKonnector>
          ) : (
            <>
              <FileIcon
                file={file}
                size={size}
                isEncrypted={isEncrypted}
                viewType={viewType}
              />
              {file.class !== 'shortcut' &&
                showSharedBadge &&
                viewType === 'grid' && (
                  <SharedBadge
                    docId={file._id}
                    {...componentsProps.sharedBadge}
                    small
                  />
                )}
            </>
          )}
        </Box>
      )
    }
  }
  if (isKonnectorFolder) {
    return (
      <BadgeKonnector file={file}>
        <FileIcon
          file={file}
          size={size}
          isEncrypted={isEncrypted}
          viewType={viewType}
        />
      </BadgeKonnector>
    )
  }

  return (
    <>
      {isSimpleFile && (
        <FileIcon
          file={file}
          size={size}
          isEncrypted={isEncrypted}
          viewType={viewType}
        />
      )}
      {isRegularShortcut && (
        <InfosBadge badgeContent={<Icon icon={LinkIcon} size={10} />}>
          <FileIcon
            file={file}
            size={size}
            isEncrypted={isEncrypted}
            viewType={viewType}
          />
        </InfosBadge>
      )}
      {isSharingShortcut && (
        <GhostFileBadge
          badgeContent={<SharingShortcutIcon file={file} size={16} />}
        >
          <SharingOwnerAvatar docId={file._id} size="small" />
        </GhostFileBadge>
      )}
      {isInSyncFromSharing && (
        <span data-testid="fil-file-thumbnail--spinner">
          <Spinner
            size="large"
            className={styles['fil-file-thumbnail--spinner']}
          />
        </span>
      )}
      {/**
       * @todo
       * Since for shortcut we already display a kind of badge we're currently just
       * not displaying the sharedBadge. Besides on desktop we have added sharing avatars.
       * The next functionnal's task is to work on sharing and we'll remove
       * this badge from here. In the meantime, we take this workaround
       */}
      {file.class !== 'shortcut' && showSharedBadge && !isInSyncFromSharing && (
        <SharedBadge docId={file._id} {...componentsProps.sharedBadge} xsmall />
      )}
    </>
  )
}

export default FileThumbnail
