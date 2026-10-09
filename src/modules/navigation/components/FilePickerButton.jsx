import { Icon, Folder, Openwith } from '@linagora/twake-icons'
import React, { useMemo, useState } from 'react'

import { useQuery } from 'cozy-client'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Checkbox from 'cozy-ui/transpiled/react/Checkbox'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import FormControlLabel from 'cozy-ui/transpiled/react/FormControlLabel'
import RadioGroup from 'cozy-ui/transpiled/react/RadioGroup'
import Radios from 'cozy-ui/transpiled/react/Radios'
import TextField from 'cozy-ui/transpiled/react/TextField'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import IntentDialogOpener from 'cozy-ui-plus/dist/Intent/IntentDialogOpener'
import { useI18n } from 'twake-i18n'

import logger from '@/lib/logger'
import { filePickerThemes } from '@/modules/services/components/FilePicker/constants'
import { buildFolderByPathQuery } from '@/queries'

function getFilePickerConfigs(t, photosFolderId) {
  return [
    {
      id: 'default',
      label: 'Default (sharing + download)',
      options: {
        sharingLink: { label: t('FilePicker.actions.sharingLink') },
        downloadLink: { label: t('FilePicker.actions.downloadLink') }
      }
    },
    {
      id: 'single-selection',
      label: 'Single selection',
      options: {
        multiple: false,
        documents: {},
        sharingLink: { label: t('FilePicker.actions.sharingLink') },
        downloadLink: { label: t('FilePicker.actions.downloadLink') }
      }
    },
    {
      id: 'documents-only',
      label: 'Documents only',
      options: {
        documents: {},
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'documents-and-download',
      label: 'Documents and download link',
      options: {
        documents: {},
        sharingLink: null,
        downloadLink: { label: 'Download link' }
      }
    },
    {
      id: 'documents-and-sharing',
      label: 'Documents and sharing link',
      options: {
        documents: {},
        sharingLink: { label: 'Public link' },
        downloadLink: null
      }
    },
    {
      id: 'all-actions',
      label: 'All 3 actions',
      options: {
        documents: {},
        sharingLink: { label: 'Public link' },
        downloadLink: { label: 'Download link' }
      }
    },
    {
      id: 'sharing-only',
      label: 'Sharing only',
      options: {
        documents: null,
        sharingLink: { label: 'Public link' },
        downloadLink: null
      }
    },
    {
      id: 'download-only',
      label: 'Download only',
      options: {
        documents: null,
        sharingLink: null,
        downloadLink: { label: 'Download link' }
      }
    },
    {
      id: 'no-actions',
      label: 'No actions',
      options: {
        documents: null,
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'custom-labels',
      label: 'Custom action labels',
      options: {
        documents: { label: 'Custom Document Label' },
        sharingLink: { label: 'Custom Sharing Label' },
        downloadLink: { label: 'Custom Download Label' }
      }
    },
    {
      id: 'custom-labels-links-only',
      label: 'Custom labels on link actions',
      options: {
        sharingLink: { label: 'Publish to Web' },
        downloadLink: { label: 'Direct Download' }
      }
    },
    {
      id: 'custom-doc-label',
      label: 'Custom documents button label',
      options: {
        documents: { label: 'Import Documents' },
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'accept-folder',
      label: 'Accept: folders only',
      options: {
        documents: { accept: ['folder'] },
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'accept-file',
      label: 'Accept: files only',
      options: {
        documents: { accept: ['file'] },
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'accept-image',
      label: 'Accept: images only',
      options: {
        documents: { accept: ['image/*'] },
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'accept-empty',
      label: 'Accept: empty array',
      options: {
        documents: { accept: [] },
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'accept-folder-and-image',
      label: 'Accept: folders and images',
      options: {
        documents: { accept: ['folder', 'image/*'] },
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'max-file-count',
      label: 'Max file count: 1',
      options: {
        documents: { maxFileCount: 1 },
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'available-size-1kb',
      label: 'Available size 1 KB',
      options: {
        documents: { availableSize: 1024 },
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'tabs-recents-drive',
      label: 'Tabs: recents and drive',
      options: {
        tabs: ['recents', 'drive'],
        documents: {}
      }
    },
    {
      id: 'tabs-drive-only',
      label: 'Tabs: drive only',
      options: {
        tabs: ['drive'],
        documents: {}
      }
    },
    {
      id: 'tabs-canonical-order',
      label: 'Tabs: sharings and recents',
      options: {
        tabs: ['sharings', 'recents'],
        documents: {}
      }
    },
    {
      id: 'tabs-empty',
      label: 'Tabs: empty array (error)',
      options: {
        tabs: []
      }
    },
    {
      id: 'tabs-unknown',
      label: 'Tabs: unknown tab (error)',
      options: {
        tabs: ['drive', 'unknown_section']
      }
    },
    {
      id: 'restrict-missing-dir',
      label: 'Restrict without defaultDirId (error)',
      options: {
        restrictToDefaultDir: true,
        documents: {}
      }
    },
    {
      id: 'restrict-forbidden-tabs',
      label: 'Restrict with forbidden tabs (error)',
      options: {
        restrictToDefaultDir: true,
        tabs: ['drive', 'recents'],
        documents: {}
      }
    },
    {
      id: 'photos-picker',
      label: 'Photos picker',
      options: {
        defaultDirId: photosFolderId,
        restrictToDefaultDir: true,
        multiple: false,
        documents: {},
        sharingLink: null,
        downloadLink: null
      }
    },
    {
      id: 'image-only',
      label: 'Image only',
      options: {
        sharingLink: null,
        downloadLink: {
          label: 'Attach image',
          accept: ['image/*']
        }
      }
    },
    {
      id: 'max-size-1kb',
      label: 'Max size 1 KB',
      options: {
        sharingLink: null,
        downloadLink: {
          label: 'Attach small file',
          maxFileSize: 1024
        }
      }
    },
    {
      id: 'max-size-and-available-size',
      label: 'Max 50 MB per file / 100 MB total',
      options: {
        sharingLink: null,
        downloadLink: {
          label: 'Attach files',
          maxFileSize: 50 * 1024 * 1024,
          availableSize: 100 * 1024 * 1024
        }
      }
    },
    {
      id: 'no-folder-sharing',
      label: 'No folder sharing',
      options: {
        sharingLink: { label: 'Share file only', accept: ['file'] },
        downloadLink: null
      }
    }
  ]
}

function buildFilePickerOptions({
  configId,
  t,
  photosFolderId,
  defaultDirIdInput,
  restrictToDefaultDirChecked
}) {
  const configs = getFilePickerConfigs(t, photosFolderId)
  const config = configs.find(({ id }) => id === configId) ?? configs[0]
  const resultOptions = { ...config.options }
  if (defaultDirIdInput) {
    resultOptions.defaultDirId = defaultDirIdInput
  }
  if (restrictToDefaultDirChecked) {
    resultOptions.restrictToDefaultDir = true
  }

  return resultOptions
}

export const FilePickerButton = () => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const [modalData, setModalData] = useState(null)
  const [configId, setConfigId] = useState('default')
  const [themeType, setThemeType] = useState(filePickerThemes[0])
  const [defaultDirIdInput, setDefaultDirIdInput] = useState('')
  const [restrictToDefaultDirChecked, setRestrictToDefaultDirChecked] =
    useState(false)

  const photosQuery = buildFolderByPathQuery('/Photos')
  const { data: photosFolders } = useQuery(
    photosQuery.definition,
    photosQuery.options
  )
  const photosFolder = photosFolders?.[0]
  const photosFolderId = photosFolder?.id ?? photosFolder?._id

  const filePickerOptions = useMemo(
    () => ({
      ...buildFilePickerOptions({
        configId,
        t,
        photosFolderId,
        defaultDirIdInput,
        restrictToDefaultDirChecked
      }),
      ...(themeType === 'default' ? {} : { theme: { type: themeType } })
    }),
    [
      configId,
      defaultDirIdInput,
      photosFolderId,
      restrictToDefaultDirChecked,
      t,
      themeType
    ]
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
    setModalData(null)
  }

  const handleCloseModal = () => setModalData(null)

  return (
    <div className="u-p-1-half">
      <RadioGroup
        name="file-picker-config"
        value={configId}
        onChange={event => setConfigId(event.target.value)}
      >
        {getFilePickerConfigs(t, photosFolderId).map(config => (
          <FormControlLabel
            key={config.id}
            value={config.id}
            disabled={config.id === 'photos-picker' && !photosFolderId}
            control={<Radios />}
            label={config.label}
          />
        ))}
      </RadioGroup>
      <div className="u-mb-1">
        <TextField
          label="Default directory ID"
          value={defaultDirIdInput}
          onChange={event => setDefaultDirIdInput(event.target.value)}
          size="small"
          fullWidth
          margin="dense"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={restrictToDefaultDirChecked}
              onChange={event =>
                setRestrictToDefaultDirChecked(event.target.checked)
              }
            />
          }
          label="Restrict to default directory"
        />
      </div>
      <RadioGroup
        name="file-picker-theme"
        value={themeType}
        onChange={event => setThemeType(event.target.value)}
      >
        <FormControlLabel
          key="default"
          value="default"
          control={<Radios />}
          label="Theme: default"
        />
        {filePickerThemes.map(themeOption => (
          <FormControlLabel
            key={themeOption}
            value={themeOption}
            control={<Radios />}
            label={`Theme: ${themeOption[0].toUpperCase()}${themeOption.slice(
              1
            )}`}
          />
        ))}
      </RadioGroup>
      <IntentDialogOpener
        action="PICK"
        doctype="io.cozy.files"
        options={filePickerOptions}
        classes={{ paper: 'u-h-100' }}
        fullScreen={isMobile}
        fullWidth
        maxWidth="md"
        iframeProps={{ spinnerProps: { middle: true } }}
        showCloseButton={false}
        onComplete={handleComplete}
        onDismiss={handleDismiss}
      >
        <Button
          disabled={configId === 'photos-picker' && !photosFolderId}
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
