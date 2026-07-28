export const FILE_TYPE_VALUES = [
  'directory',
  'text',
  'sheet',
  'slide',
  'image',
  'pdf',
  'video',
  'zip',
  'audio',
  'excalidraw',
  'shortcut'
] as const

export type FileType = (typeof FILE_TYPE_VALUES)[number]

const FILE_TYPE_VALUE_SET = new Set<string>(FILE_TYPE_VALUES)

export function isFileType(value: unknown): value is FileType {
  return typeof value === 'string' && FILE_TYPE_VALUE_SET.has(value)
}
