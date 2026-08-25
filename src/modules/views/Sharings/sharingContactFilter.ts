import type { IOCozyFile } from 'cozy-client/types/types'
import type {
  SharingGroupRecipient,
  SharingMemberRecipient,
  SharingRecipient
} from 'cozy-sharing/types'

import type { SharingsTab } from './useSharingsTab'

import { SHARING_TAB_BY_ME, SHARING_TAB_WITH_ME } from '@/constants/config'
import { normalizeSearchText } from '@/lib/normalizeSearchText'

interface SharingsContactFilterOptionBase {
  label: string
  searchableValues: readonly string[]
  secondaryLabel?: string
  value: string
}

export type SharingsContactFilterOptionData =
  | (SharingsContactFilterOptionBase & {
      kind: 'group'
      recipient: SharingGroupRecipient
    })
  | (SharingsContactFilterOptionBase & {
      kind: 'person'
      recipient: SharingMemberRecipient
    })

export interface SharingsContactFilterData {
  contactValuesByEntryId: ReadonlyMap<string, readonly string[]>
  options: SharingsContactFilterOptionData[]
}

function getContactOption(
  recipient: SharingRecipient
): SharingsContactFilterOptionData | null {
  if ('groupIndex' in recipient) {
    const label = recipient.name
    const identity = recipient.id ?? label
    return {
      kind: 'group',
      label,
      recipient,
      searchableValues: [label],
      value: `group:${normalizeSearchText(identity).trim()}`
    }
  }

  const { public_name: publicName, name, email, instance } = recipient
  const label = publicName ?? name ?? email ?? instance
  if (label === undefined) return null

  const identity = email ?? instance ?? label
  const searchableValues = Array.from(
    new Set(
      [publicName, name, email, instance].filter(
        (value): value is string => value !== undefined
      )
    )
  )

  const secondaryLabel = [email, instance].find(
    (value): value is string => value !== undefined && value !== label
  )

  return {
    kind: 'person',
    label,
    recipient,
    searchableValues,
    ...(secondaryLabel === undefined ? {} : { secondaryLabel }),
    value: `person:${normalizeSearchText(identity).trim()}`
  }
}

function isRecipientRelevantForTab(
  recipient: SharingRecipient,
  tab: SharingsTab
): boolean {
  if ('groupIndex' in recipient) return tab === SHARING_TAB_BY_ME
  if (recipient.status === 'revoked') return false
  if (tab === SHARING_TAB_WITH_ME) return recipient.status === 'owner'
  if (tab === SHARING_TAB_BY_ME) return recipient.status !== 'owner'
  return false
}

export function getSharingsContactFilterData(
  entries: readonly IOCozyFile[],
  tab: SharingsTab,
  getRecipients: (documentId: string) => SharingRecipient[]
): SharingsContactFilterData {
  const contactValuesByEntryId = new Map<string, readonly string[]>()
  const optionsByValue = new Map<string, SharingsContactFilterOptionData>()
  const uniqueOptions: SharingsContactFilterOptionData[] = []
  const supportsContacts =
    tab === SHARING_TAB_WITH_ME || tab === SHARING_TAB_BY_ME

  for (const entry of entries) {
    const entryId = entry._id

    if (!supportsContacts) {
      contactValuesByEntryId.set(entryId, [])
      continue
    }

    const options = getRecipients(entryId)
      .filter(recipient => isRecipientRelevantForTab(recipient, tab))
      .map(getContactOption)
      .filter(
        (option): option is SharingsContactFilterOptionData => option !== null
      )

    const values = Array.from(new Set(options.map(option => option.value)))
    contactValuesByEntryId.set(entryId, values)

    for (const option of options) {
      if (!optionsByValue.has(option.value)) {
        optionsByValue.set(option.value, option)
        uniqueOptions.push(option)
      }
    }
  }

  return {
    contactValuesByEntryId,
    options: uniqueOptions.sort((left, right) =>
      left.label.localeCompare(right.label)
    )
  }
}
