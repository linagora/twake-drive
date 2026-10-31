import PropTypes from 'prop-types'
import React from 'react'
import { useDispatch } from 'react-redux'

import { Folder, Icon, Upload } from '@linagora/twake-icons'
import { useClient } from 'cozy-client'
import withSharingState from 'cozy-sharing/dist/hoc/withSharingState'
import Button from 'cozy-ui/transpiled/react/Buttons'
import FileInput from 'cozy-ui/transpiled/react/FileInput'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { uploadFiles } from '@/modules/navigation/duck'
import { usePublicContext } from '@/modules/public/PublicProvider'
import { isDirectoryPickerAvailable } from '@/modules/upload'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

const UploadButtonBase = ({
  label,
  disabled,
  className,
  displayedFolder,
  folderId,
  driveId,
  sharingState,
  componentsProps,
  variant,
  onUploaded,
  onUploadStart,
  isDirectory
}) => {
  const { showAlert } = useAlert()
  const { addItems } = useNewItemHighlightContext()
  const { t } = useI18n()
  const dispatch = useDispatch()
  const client = useClient()

  // Route identifiers remain available when proxied folders have no local document.
  const dirId = folderId !== undefined ? folderId : displayedFolder?.id
  const targetDriveId =
    driveId !== undefined ? driveId : displayedFolder?.driveId

  const onUpload = files => {
    // A picked folder holding no file at all comes back as an empty list.
    if (files.length === 0) return
    onUploadStart?.()
    dispatch(
      uploadFiles(
        files,
        dirId,
        sharingState,
        onUploaded,
        { client, showAlert, t },
        targetDriveId,
        addItems
      )
    )
  }

  const { isPublic } = usePublicContext()
  const buttonVariant = variant ?? (isPublic ? 'secondary' : 'primary')

  if (isDirectory && (disabled || !isDirectoryPickerAvailable())) return null

  const button = (
    <Button
      {...componentsProps?.button}
      variant={buttonVariant}
      disabled={disabled}
      style={
        buttonVariant === 'primary'
          ? {
              color: 'var(--primaryTextColor)',
              backgroundColor: 'var(--paperBackgroundColor)'
            }
          : undefined
      }
      component="span"
      startIcon={<Icon icon={isDirectory ? Folder : Upload} size={12} />}
      label={label}
    />
  )

  if (disabled) {
    return <div className={className}>{button}</div>
  }

  return (
    <FileInput
      className={className}
      label={label}
      disabled={disabled}
      multiple
      onChange={files => onUpload(files)}
      data-testid={isDirectory ? 'upload-folder-btn' : 'upload-btn'}
      value={[]} // always erase the value to be able to re-upload the same file
      {...(isDirectory && { webkitdirectory: '' })}
    >
      {button}
    </FileInput>
  )
}

UploadButtonBase.propTypes = {
  label: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  componentsProps: PropTypes.object,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  onUploaded: PropTypes.func,
  displayedFolder: PropTypes.object, // io.cozy.files
  folderId: PropTypes.string,
  driveId: PropTypes.string,
  onUploadStart: PropTypes.func,
  isDirectory: PropTypes.bool,
  // in case of upload conflicts, shared files are not overridden
  sharingState: PropTypes.object.isRequired
}

UploadButtonBase.defaultProps = {
  disabled: false
}

const UploadButton = withSharingState(UploadButtonBase)

export { UploadButton, UploadButtonBase }
