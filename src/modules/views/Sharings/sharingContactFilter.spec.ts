import type { IOCozyFile } from 'cozy-client/types/types'
import type {
  SharingGroupRecipient,
  SharingMember,
  SharingMemberRecipient,
  SharingRecipient
} from 'cozy-sharing/types'

import { getSharingsContactFilterData } from './sharingContactFilter'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'

const RECEIVED_FILE = {
  _id: 'received-file',
  id: 'received-file'
} as IOCozyFile
const SECOND_RECEIVED_FILE = {
  _id: 'second-received-file',
  id: 'second-received-file'
} as IOCozyFile
const OWNED_FILE = { _id: 'owned-file', id: 'owned-file' } as IOCozyFile

const OWNER_MEMBER: SharingMember = {
  status: 'owner',
  name: 'Alice from contacts',
  public_name: 'Alice Martin',
  email: 'alice@example.com',
  instance: 'https://alice.example.com'
}
const CURRENT_USER_MEMBER: SharingMember = {
  status: 'owner',
  public_name: 'Bob',
  email: 'bob@example.com'
}
const RECIPIENT_MEMBER: SharingMember = {
  status: 'ready',
  public_name: 'Claude Durand',
  email: 'claude@example.com'
}

function makeMemberRecipient(
  member: SharingMember,
  memberIndex: number
): SharingMemberRecipient {
  return {
    ...member,
    avatarPath: `/sharings/sharing/recipients/${memberIndex}/avatar`,
    index: `sharing-sharing-member-${memberIndex}`,
    memberIndex,
    sharingId: 'sharing',
    type: 'two-way'
  }
}

const OWNER = makeMemberRecipient(OWNER_MEMBER, 0)
const CURRENT_USER = makeMemberRecipient(CURRENT_USER_MEMBER, 0)
const RECIPIENT = makeMemberRecipient(RECIPIENT_MEMBER, 1)
const DESIGN_GROUP: SharingGroupRecipient = {
  addedBy: 0,
  color: '#297ef2',
  groupIndex: 0,
  id: 'design-group',
  index: 'sharing-sharing-group-0',
  members: [RECIPIENT],
  name: 'Design team',
  owner: CURRENT_USER,
  read_only: false,
  sharingId: 'sharing'
}

function makeGetRecipients(
  recipientsByDocumentId: Record<string, SharingRecipient[]> = {}
): (documentId: string) => SharingRecipient[] {
  return documentId => recipientsByDocumentId[documentId] ?? []
}

describe('getSharingsContactFilterData', () => {
  it('indexes and deduplicates owners for the With me tab', () => {
    const getRecipients = makeGetRecipients({
      [RECEIVED_FILE._id]: [OWNER, RECIPIENT],
      [SECOND_RECEIVED_FILE._id]: [OWNER]
    })

    const result = getSharingsContactFilterData(
      [RECEIVED_FILE, SECOND_RECEIVED_FILE],
      SHARING_TAB_WITH_ME,
      getRecipients
    )

    expect(result.options).toHaveLength(1)
    expect(result.options[0]).toMatchObject({
      kind: 'person',
      label: 'Alice Martin',
      secondaryLabel: 'alice@example.com',
      value: 'person:alice@example.com'
    })
    expect(result.options[0].searchableValues).toEqual(
      expect.arrayContaining([
        'Alice Martin',
        'Alice from contacts',
        'alice@example.com'
      ])
    )
    expect(result.contactValuesByEntryId.get(RECEIVED_FILE._id)).toEqual([
      'person:alice@example.com'
    ])
  })

  it('indexes direct recipients and groups for the By me tab', () => {
    const getRecipients = makeGetRecipients({
      [OWNED_FILE._id]: [CURRENT_USER, RECIPIENT, DESIGN_GROUP]
    })

    const result = getSharingsContactFilterData(
      [OWNED_FILE],
      SHARING_TAB_BY_ME,
      getRecipients
    )

    expect(result.options).toEqual([
      expect.objectContaining({
        kind: 'person',
        label: 'Claude Durand',
        value: 'person:claude@example.com'
      }),
      expect.objectContaining({
        kind: 'group',
        label: 'Design team',
        value: 'group:design-group'
      })
    ])
    expect(result.contactValuesByEntryId.get(OWNED_FILE._id)).toEqual([
      'person:claude@example.com',
      'group:design-group'
    ])
  })

  it('resolves shared drive root recipients from the document id', () => {
    const drive = {
      ...RECEIVED_FILE,
      driveId: 'sharing-drive'
    }
    const getRecipients = jest.fn(documentId =>
      documentId === RECEIVED_FILE._id ? [OWNER, RECIPIENT] : []
    )

    const result = getSharingsContactFilterData(
      [drive],
      SHARING_TAB_WITH_ME,
      getRecipients
    )

    expect(result.options).toEqual([
      expect.objectContaining({ value: 'person:alice@example.com' })
    ])
    expect(getRecipients).toHaveBeenCalledWith(RECEIVED_FILE._id)
  })

  it('does not expose contact data on the Team drives tab', () => {
    const getRecipients = jest.fn(() => [OWNER])

    const result = getSharingsContactFilterData(
      [RECEIVED_FILE],
      SHARING_TAB_DRIVES,
      getRecipients
    )

    expect(result.options).toEqual([])
    expect(result.contactValuesByEntryId.get(RECEIVED_FILE._id)).toEqual([])
    expect(getRecipients).not.toHaveBeenCalled()
  })
})
