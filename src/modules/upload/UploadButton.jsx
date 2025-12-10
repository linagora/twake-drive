import PropTypes from 'prop-types'
import React from 'react'
import { useDispatch } from 'react-redux'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { useVaultClient } from 'cozy-keys-lib'
import withSharingState from 'cozy-sharing/dist/hoc/withSharingState'
import Button from 'cozy-ui/transpiled/react/Buttons'
import FileInput from 'cozy-ui/transpiled/react/FileInput'
import Icon from 'cozy-ui/transpiled/react/Icon'
import UploadIcon from 'cozy-ui/transpiled/react/Icons/Upload'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { uploadFiles } from '@/modules/navigation/duck'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

const UploadButton = ({
  label,
  disabled,
  className,
  displayedFolder,
  sharingState,
  componentsProps,
  onUploaded
}) => {
  const { showAlert } = useAlert()
  const { addItems } = useNewItemHighlightContext()
  const { t } = useI18n()
  const dispatch = useDispatch()
  const client = useClient()
  const vaultClient = useVaultClient()

  const onUpload = files => {
    dispatch(
      uploadFiles(
        files,
        displayedFolder.id,
        sharingState,
        onUploaded,
        {
          client,
          vaultClient,
          showAlert,
          t
        },
        displayedFolder.driveId,
        addItems
      )
    )
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
      <Button
        {...componentsProps?.button}
        component="span"
        startIcon={<Icon icon={UploadIcon} />}
        label={label}
      />
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
  // in case of upload conflicts, shared files are not overridden
  sharingState: PropTypes.object.isRequired
}

UploadButton.defaultProps = {
  disabled: false
}

export default withSharingState(UploadButton)
