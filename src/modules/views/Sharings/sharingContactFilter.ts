import type { IOCozyFile } from 'cozy-client/types/types'
import { getRecipientsFromSharing } from 'cozy-sharing'

import type { SharingsTab } from './useSharingsTab'

import { SHARING_TAB_BY_ME, SHARING_TAB_WITH_ME } from '@/constants/config'
import { normalizeSearchText } from '@/lib/normalizeSearchText'

type SharingContactKind = 'group' | 'person'

interface SharingContactEntry extends IOCozyFile {
  driveId?: string
}

export interface SharingContactSource {
  getRecipients: (documentId: string) => unknown
  getSharingById: (sharingId: string) => unknown
}

export interface SharingsContactFilterOptionData {
  kind: SharingContactKind
  label: string
  recipient: Record<string, unknown>
  searchableValues: readonly string[]
  secondaryLabel?: string
  value: string
}

export interface SharingsContactFilterData {
  contactValuesByEntryId: ReadonlyMap<string, readonly string[]>
  options: SharingsContactFilterOptionData[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function getContactOption(
  recipient: Record<string, unknown>
): SharingsContactFilterOptionData | null {
  const kind: SharingContactKind =
    typeof recipient.groupIndex === 'number' ? 'group' : 'person'
  const publicName = getString(recipient.public_name)
  const name = getString(recipient.name)
  const email = getString(recipient.email)
  const instance = getString(recipient.instance)
  const label =
    kind === 'group' ? name : (publicName ?? name ?? email ?? instance)
  if (label === null) return null

  const identity =
    kind === 'group'
      ? (getString(recipient.id) ?? label)
      : (email ?? instance ?? label)
  const searchableValues = Array.from(
    new Set(
      [publicName, name, email, instance].filter(
        (value): value is string => value !== null
      )
    )
  )

  const secondaryLabel =
    kind === 'person'
      ? ([email, instance].find(value => value !== null && value !== label) ??
        null)
      : null

  return {
    kind,
    label,
    recipient,
    searchableValues,
    ...(secondaryLabel === null ? {} : { secondaryLabel }),
    value: `${kind}:${normalizeSearchText(identity).trim()}`
  }
}

function getRecipientsForEntry(
  entry: SharingContactEntry,
  source: SharingContactSource
): Record<string, unknown>[] {
  const entryId = entry._id

  const sharing = entry.driveId ? source.getSharingById(entry.driveId) : null
  const recipients = sharing
    ? getRecipientsFromSharing(sharing, entryId)
    : source.getRecipients(entryId)

  return Array.isArray(recipients) ? recipients.filter(isRecord) : []
}

function isRecipientRelevantForTab(
  recipient: Record<string, unknown>,
  tab: SharingsTab
): boolean {
  const status = getString(recipient.status)
  if (status === 'revoked') return false
  if (tab === SHARING_TAB_WITH_ME) return status === 'owner'
  if (tab === SHARING_TAB_BY_ME) return status !== 'owner'
  return false
}

export function getSharingsContactFilterData(
  entries: readonly SharingContactEntry[],
  tab: SharingsTab,
  source: SharingContactSource
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

    const options = getRecipientsForEntry(entry, source)
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
