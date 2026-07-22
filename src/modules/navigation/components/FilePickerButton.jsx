import { Icon, Folder, Openwith } from '@linagora/twake-icons'
import React, { useMemo, useState } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import FormControlLabel from 'cozy-ui/transpiled/react/FormControlLabel'
import RadioGroup from 'cozy-ui/transpiled/react/RadioGroup'
import Radios from 'cozy-ui/transpiled/react/Radios'
import IntentDialogOpener from 'cozy-ui-plus/dist/Intent/IntentDialogOpener'
import { useI18n } from 'twake-i18n'

import logger from '@/lib/logger'

const PICKER_CONFIGS = [
  {
    id: 'default',
    label: 'Default (sharing + download)'
  },
  {
    id: 'single-selection',
    label: 'Single selection'
  },
  {
    id: 'sharing-only',
    label: 'Sharing link only'
  },
  {
    id: 'download-only',
    label: 'Download link only'
  },
  {
    id: 'image-only',
    label: 'Image only'
  },
  {
    id: 'max-size-1kb',
    label: 'Max size 1 KB'
  },
  {
    id: 'no-folder-sharing',
    label: 'No folder sharing'
  }
]

const buildFilePickerOptions = (configId, t) => {
  switch (configId) {
    case 'single-selection':
      return { multiple: false }
    case 'sharing-only':
      return {
        sharingLink: { label: 'Share as link' },
        downloadLink: null
      }
    case 'download-only':
      return {
        sharingLink: null,
        downloadLink: { label: 'Attach file' }
      }
    case 'image-only':
      return {
        sharingLink: null,
        downloadLink: {
          label: 'Attach image',
          allowedMimeTypes: ['image/*']
        }
      }
    case 'max-size-1kb':
      return {
        sharingLink: null,
        downloadLink: {
          label: 'Attach small file',
          maxFileSize: 1024
        }
      }
    case 'no-folder-sharing':
      return {
        sharingLink: { label: 'Share file only', allowFolder: false },
        downloadLink: null
      }
    case 'default':
    default:
      return {
        sharingLink: { label: t('FilePicker.actions.sharingLink') },
        downloadLink: { label: t('FilePicker.actions.downloadLink') }
      }
  }
}

export const FilePickerButton = () => {
  const { t } = useI18n()
  const [modalData, setModalData] = useState(null)
  const [configId, setConfigId] = useState(PICKER_CONFIGS[0].id)

  const filePickerOptions = useMemo(
    () => buildFilePickerOptions(configId, t),
    [configId, t]
  )

  const handleComplete = res => {
    logger.info('onComplete', res)
    res.removeIntentIframe?.()

    const document = res.document
    const file = Array.isArray(document) ? document[0] : null
    const link = file ? file.sharingLink || file.downloadLink : null

    setModalData({
      name: file && file.name ? file.name : '',
      link,
      document
    })
  }

  const handleDismiss = () => {
    logger.info('onDismiss')
  }

  const handleCloseModal = () => setModalData(null)

  return (
    <div className="u-p-1-half">
      <RadioGroup
        name="file-picker-config"
        value={configId}
        onChange={event => setConfigId(event.target.value)}
      >
        {PICKER_CONFIGS.map(config => (
          <FormControlLabel
            key={config.id}
            value={config.id}
            control={<Radios />}
            label={config.label}
          />
        ))}
      </RadioGroup>
      <IntentDialogOpener
        action="PICK"
        doctype="io.cozy.files"
        options={filePickerOptions}
        classes={{ paper: 'u-h-100' }}
        fullWidth
        maxWidth="md"
        iframeProps={{ spinnerProps: { middle: true } }}
        onComplete={handleComplete}
        onDismiss={handleDismiss}
      >
        <Button
          label={t('Nav.item_file_picker')}
          startIcon={<Icon icon={Folder} />}
          variant="secondary"
          className="u-w-100 u-bdrs-6"
        />
      </IntentDialogOpener>
      {modalData && (
        <ConfirmDialog
          open
          size="medium"
          onClose={handleCloseModal}
          title={t('FilePicker.linkTitle', { name: modalData.name })}
          content={
            <div>
              {modalData.link && (
                <a
                  href={modalData.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-flex u-flex-items-center"
                >
                  <Icon icon={Openwith} className="u-mr-half" />
                  {modalData.link}
                </a>
              )}
              <pre data-testid="file-picker-result">
                {JSON.stringify(modalData.document, null, 2)}
              </pre>
            </div>
          }
          actions={
            <Button label={t('FilePicker.close')} onClick={handleCloseModal} />
          }
        />
      )}
    </div>
  )
}

export default FilePickerButton
