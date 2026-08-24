import type { IOCozyFile } from 'cozy-client/types/types'

import {
  getSharingsContactFilterData,
  type SharingContactSource
} from './sharingContactFilter'

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

const OWNER = {
  status: 'owner',
  name: 'Alice from contacts',
  public_name: 'Alice Martin',
  email: 'alice@example.com',
  instance: 'https://alice.example.com'
}
const CURRENT_USER = {
  status: 'owner',
  public_name: 'Bob',
  email: 'bob@example.com'
}
const RECIPIENT = {
  status: 'ready',
  public_name: 'Claude Durand',
  email: 'claude@example.com'
}
const DESIGN_GROUP = {
  id: 'design-group',
  groupIndex: 0,
  name: 'Design team',
  color: '#297ef2'
}

function makeSource(
  recipientsByDocumentId: Record<string, unknown[]> = {}
): SharingContactSource {
  return {
    getRecipients: documentId => recipientsByDocumentId[documentId] ?? [],
    getSharingById: () => null
  }
}

describe('getSharingsContactFilterData', () => {
  it('indexes and deduplicates owners for the With me tab', () => {
    const source = makeSource({
      [RECEIVED_FILE._id]: [OWNER, RECIPIENT],
      [SECOND_RECEIVED_FILE._id]: [OWNER]
    })

    const result = getSharingsContactFilterData(
      [RECEIVED_FILE, SECOND_RECEIVED_FILE],
      SHARING_TAB_WITH_ME,
      source
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
    const source = makeSource({
      [OWNED_FILE._id]: [CURRENT_USER, RECIPIENT, DESIGN_GROUP]
    })

    const result = getSharingsContactFilterData(
      [OWNED_FILE],
      SHARING_TAB_BY_ME,
      source
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

  it('resolves shared drive recipients from the sharing id', () => {
    const drive = {
      ...RECEIVED_FILE,
      driveId: 'sharing-drive'
    }
    const source: SharingContactSource = {
      getRecipients: jest.fn(() => []),
      getSharingById: sharingId =>
        sharingId === 'sharing-drive'
          ? {
              id: 'sharing-drive',
              attributes: {
                members: [OWNER, RECIPIENT],
                rules: [
                  {
                    values: [RECEIVED_FILE._id],
                    update: 'sync',
                    remove: 'sync'
                  }
                ]
              }
            }
          : null
    }

    const result = getSharingsContactFilterData(
      [drive],
      SHARING_TAB_WITH_ME,
      source
    )

    expect(result.options).toEqual([
      expect.objectContaining({ value: 'person:alice@example.com' })
    ])
    expect(source.getRecipients).not.toHaveBeenCalled()
  })

  it('does not expose contact data on the Team drives tab', () => {
    const source: SharingContactSource = {
      getRecipients: jest.fn(() => [OWNER]),
      getSharingById: jest.fn(() => null)
    }

    const result = getSharingsContactFilterData(
      [RECEIVED_FILE],
      SHARING_TAB_DRIVES,
      source
    )

    expect(result.options).toEqual([])
    expect(result.contactValuesByEntryId.get(RECEIVED_FILE._id)).toEqual([])
    expect(source.getRecipients).not.toHaveBeenCalled()
    expect(source.getSharingById).not.toHaveBeenCalled()
  })
})
