import {
  FileTypeAudio,
  FileTypeFolder,
  FileTypeImage,
  FileTypePdf,
  FileTypeSheet,
  FileTypeSlide,
  FileTypeText,
  FileTypeVideo,
  FileTypeZip,
  Globe
} from '@linagora/twake-icons'

import IconExcalidraw from '@/assets/icons/icon-excalidraw.svg'

export const FILE_TYPE_OPTIONS = [
  {
    value: 'directory',
    labelKey: 'filters.type.options.folder',
    icon: FileTypeFolder
  },
  {
    value: 'text',
    labelKey: 'filters.type.options.document',
    icon: FileTypeText
  },
  {
    value: 'sheet',
    labelKey: 'filters.type.options.spreadsheet',
    icon: FileTypeSheet
  },
  {
    value: 'slide',
    labelKey: 'filters.type.options.presentation',
    icon: FileTypeSlide
  },
  {
    value: 'image',
    labelKey: 'filters.type.options.photo',
    icon: FileTypeImage
  },
  {
    value: 'pdf',
    labelKey: 'filters.type.options.pdf',
    icon: FileTypePdf
  },
  {
    value: 'video',
    labelKey: 'filters.type.options.video',
    icon: FileTypeVideo
  },
  {
    value: 'zip',
    labelKey: 'filters.type.options.archive',
    icon: FileTypeZip
  },
  {
    value: 'audio',
    labelKey: 'filters.type.options.audio',
    icon: FileTypeAudio
  },
  {
    value: 'excalidraw',
    labelKey: 'filters.type.options.draw',
    icon: IconExcalidraw
  },
  {
    value: 'shortcut',
    labelKey: 'filters.type.options.shortcut',
    icon: Globe
  }
]

export const FILE_TYPE_VALUES = FILE_TYPE_OPTIONS.map(option => option.value)

export function findFileTypeOption(value) {
  return FILE_TYPE_OPTIONS.find(option => option.value === value) ?? null
}
