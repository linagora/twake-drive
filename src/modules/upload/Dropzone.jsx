import cx from 'classnames'
import React from 'react'
import { useDropzone } from 'react-dropzone'
import { useDispatch } from 'react-redux'

import { useClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { Content } from 'cozy-ui/transpiled/react/Layout'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import styles from '@/styles/dropzone.styl'

import RightClickAddMenu from '@/components/RightClick/RightClickAddMenu'
import { uploadFiles } from '@/modules/navigation/duck'
import DropzoneTeaser from '@/modules/upload/DropzoneTeaser'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

const canDrop = evt => {
  const items = evt.dataTransfer.items
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].kind !== 'file') return false
  }
  return true
}

export const Dropzone = ({
  displayedFolder,
  disabled,
  refreshFolderContent = null,
  children
}) => {
  const client = useClient()
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const { showAlert } = useAlert()
  const sharingState = useSharingContext()
  const dispatch = useDispatch()
  const { addItems } = useNewItemHighlightContext()

  const fileUploadCallback = refreshFolderContent
    ? refreshFolderContent
    : () => null

  const onDrop = async (files, _, evt) => {
    if (!canDrop(evt)) return

    // react-dropzone v14 (default `getFilesFromEvent: fromEvent` from
    // file-selector) walks dropped folders and gives us individual File
    // objects with `.path` set to the relative path inside the dropped
    // folder. addToUploadQueue uses those paths to flatten into per-file
    // queue items at enqueue time.
    dispatch(
      uploadFiles(
        files,
        displayedFolder.id,
        sharingState,
        fileUploadCallback,
        { client, showAlert, t },
        displayedFolder.driveId,
        addItems
      )
    )
  }

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    noClick: true,
    noKeyboard: true
  })

  return (
    <RightClickAddMenu>
      <Content
        className={cx(isMobile ? '' : 'u-pt-1', {
          [styles['fil-dropzone-active']]: isDragActive
        })}
        {...getRootProps()}
      >
        {isDragActive && <DropzoneTeaser currentFolder={displayedFolder} />}
        {children}
      </Content>
    </RightClickAddMenu>
  )
}

export default Dropzone
