import PropTypes from 'prop-types'
import React from 'react'
import { useDispatch } from 'react-redux'

import { useClient } from 'cozy-client'
import withSharingState from 'cozy-sharing/dist/hoc/withSharingState'
import Button from 'cozy-ui/transpiled/react/Buttons'
import FileInput from 'cozy-ui/transpiled/react/FileInput'
import Icon from 'cozy-ui/transpiled/react/Icon'
import UploadIcon from 'cozy-ui/transpiled/react/Icons/Upload'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { uploadFiles } from '@/modules/navigation/duck'
import { usePublicContext } from '@/modules/public/PublicProvider'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

const UploadButton = ({
  label,
  disabled,
  className,
  displayedFolder,
  folderId,
  sharingState,
  componentsProps,
  onUploaded,
  onUploadStart
}) => {
  const { showAlert } = useAlert()
  const { addItems } = useNewItemHighlightContext()
  const { t } = useI18n()
  const dispatch = useDispatch()
  const client = useClient()

  // Explicit folderId (e.g. null on no-folder sections) overrides displayedFolder.id.
  const dirId = folderId !== undefined ? folderId : displayedFolder?.id

  const onUpload = files => {
    onUploadStart?.()
    dispatch(
      uploadFiles(
        files,
        dirId,
        sharingState,
        onUploaded,
        { client, showAlert, t },
        displayedFolder?.driveId,
        addItems
      )
    )
  }

  const { isPublic } = usePublicContext()

  const button = (
    <Button
      {...componentsProps?.button}
      variant={isPublic ? 'secondary' : 'primary'}
      disabled={disabled}
      style={
        isPublic
          ? undefined
          : {
              color: 'var(--primaryTextColor)',
              backgroundColor: 'var(--paperBackgroundColor)'
            }
      }
      component="span"
      startIcon={<Icon icon={UploadIcon} size={12} />}
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
      data-testid="upload-btn"
      value={[]} // always erase the value to be able to re-upload the same file
    >
      {button}
    </FileInput>
  )
}

UploadButton.propTypes = {
  label: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  componentsProps: PropTypes.object,
  onUploaded: PropTypes.func,
  displayedFolder: PropTypes.object, // io.cozy.files
  folderId: PropTypes.string,
  onUploadStart: PropTypes.func,
  // in case of upload conflicts, shared files are not overridden
  sharingState: PropTypes.object.isRequired
}

UploadButton.defaultProps = {
  disabled: false
}

export default withSharingState(UploadButton)
