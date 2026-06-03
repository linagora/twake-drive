import { IOCozyFile } from 'cozy-client/types/types'

import type { SharingRule } from '@/modules/shareddrives/types'

type FileWithAttributes = Partial<IOCozyFile> & {
  class?: string
  attributes?: Partial<IOCozyFile> & {
    name?: string
    mime?: string
    class?: string
  }
}

const hasFileExtension = (name?: string): boolean =>
  typeof name === 'string' && /\.[^/.]+$/.test(name)

export const getSharedDriveRootRule = (sharedDrive?: {
  rules?: SharingRule[]
}): SharingRule | undefined => sharedDrive?.rules?.[0]

const resolveSharedDriveRootFileName = ({
  fetchedName,
  ruleName,
  fallbackName
}: {
  fetchedName?: string
  ruleName?: string
  fallbackName?: string
}): string | undefined => {
  // Shared-drive root-file fetches can lose the extension, while the sharing
  // rule keeps the user-visible title used by viewer format detection.
  if (hasFileExtension(fetchedName) || !ruleName) {
    return fetchedName || ruleName || fallbackName
  }

  return ruleName
}

export const getSharedDriveRootFileMetadata = ({
  file = {},
  rootRule,
  fallbackName
}: {
  file?: FileWithAttributes
  rootRule?: SharingRule
  fallbackName?: string
}): {
  name?: string
  mime?: string
  class?: string
} => {
  const name = resolveSharedDriveRootFileName({
    fetchedName: file.name || file.attributes?.name,
    ruleName: rootRule?.title,
    fallbackName
  })
  const mime = file.mime || file.attributes?.mime || rootRule?.mime
  const fileClass = file.class || file.attributes?.class

  return {
    ...(name ? { name } : {}),
    ...(mime ? { mime } : {}),
    ...(fileClass ? { class: fileClass } : {})
  }
}
