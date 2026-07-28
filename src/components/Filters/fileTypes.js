import { FileTypeFolder, Globe } from '@linagora/twake-icons'

import IconExcalidraw from '@/assets/icons/icon-excalidraw.svg'
import { MIME_TYPE_ICONS } from '@/lib/getMimeTypeIcon'

export const FILE_TYPE_OPTIONS = [
  {
    value: 'directory',
    labelKey: 'filters.type.options.folder',
    icon: FileTypeFolder
  },
  {
    value: 'text',
    labelKey: 'filters.type.options.document',
    icon: MIME_TYPE_ICONS.text
  },
  {
    value: 'sheet',
    labelKey: 'filters.type.options.spreadsheet',
    icon: MIME_TYPE_ICONS.sheet
  },
  {
    value: 'slide',
    labelKey: 'filters.type.options.presentation',
    icon: MIME_TYPE_ICONS.slide
  },
  {
    value: 'image',
    labelKey: 'filters.type.options.photo',
    icon: MIME_TYPE_ICONS.image
  },
  {
    value: 'pdf',
    labelKey: 'filters.type.options.pdf',
    icon: MIME_TYPE_ICONS.pdf
  },
  {
    value: 'video',
    labelKey: 'filters.type.options.video',
    icon: MIME_TYPE_ICONS.video
  },
  {
    value: 'zip',
    labelKey: 'filters.type.options.archive',
    icon: MIME_TYPE_ICONS.zip
  },
  {
    value: 'audio',
    labelKey: 'filters.type.options.audio',
    icon: MIME_TYPE_ICONS.audio
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

export function findFileTypeOption(value) {
  return FILE_TYPE_OPTIONS.find(option => option.value === value) ?? null
}
