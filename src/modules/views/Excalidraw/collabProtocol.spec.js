import {
  collaboratorsFromPeers,
  colorFromSessionId,
  isCollabMessage,
  makeSessionId,
  prunePeers,
  shouldRespondToHello,
  unwrapMessage
} from './collabProtocol'

describe('collabProtocol', () => {
  describe('makeSessionId', () => {
    it('produces distinct ids', () => {
      expect(makeSessionId()).not.toBe(makeSessionId())
    })
  })

  describe('colorFromSessionId', () => {
    it('is deterministic for a given id', () => {
      expect(colorFromSessionId('peer-1')).toEqual(colorFromSessionId('peer-1'))
    })

    it('returns a background and stroke', () => {
      const color = colorFromSessionId('peer-1')
      expect(color.background).toMatch(/^hsl\(/)
      expect(color.stroke).toMatch(/^hsl\(/)
    })
  })

  describe('unwrapMessage', () => {
    it('unwraps the message nested under .data', () => {
      const message = { senderId: 'a', type: 'SCENE_UPDATE' }
      expect(unwrapMessage({ data: message, _type: 'doctype' })).toBe(message)
    })

    it('falls back to the doc itself when there is no .data', () => {
      const message = { senderId: 'a', type: 'SCENE_UPDATE' }
      expect(unwrapMessage(message)).toBe(message)
    })

    it('returns null for an empty doc', () => {
      expect(unwrapMessage(null)).toBe(null)
    })
  })

  describe('isCollabMessage', () => {
    it('accepts a well-formed message', () => {
      expect(
        isCollabMessage({ senderId: 'peer-1', type: 'SCENE_UPDATE' })
      ).toBe(true)
    })

    it('rejects a null or non-object payload', () => {
      expect(isCollabMessage(null)).toBe(false)
    })

    it('rejects a message without a string sender id', () => {
      expect(isCollabMessage({ type: 'PRESENCE_PING' })).toBe(false)
      expect(isCollabMessage({ senderId: 42, type: 'PRESENCE_PING' })).toBe(
        false
      )
    })

    it('rejects an unknown message type', () => {
      expect(isCollabMessage({ senderId: 'peer-1', type: 'SOMETHING' })).toBe(
        false
      )
      expect(isCollabMessage({ senderId: 'peer-1' })).toBe(false)
    })
  })

  describe('shouldRespondToHello', () => {
    it('lets the lone existing peer answer a newcomer', () => {
      expect(shouldRespondToHello('a', [], 'b')).toBe(true)
    })

    it('lets only the smallest existing id answer', () => {
      expect(shouldRespondToHello('a', ['c'], 'b')).toBe(true)
      expect(shouldRespondToHello('c', ['a'], 'b')).toBe(false)
    })

    it('never answers its own HELLO', () => {
      // The newcomer sees only itself among existing peers, so it stays silent.
      expect(shouldRespondToHello('b', [], 'b')).toBe(false)
    })
  })

  describe('prunePeers', () => {
    const peers = new Map([
      ['fresh', { lastSeen: 1000 }],
      ['stale', { lastSeen: 100 }]
    ])

    it('drops peers past the TTL and flags the change', () => {
      const result = prunePeers(peers, 1000, 500)
      expect([...result.peers.keys()]).toEqual(['fresh'])
      expect(result.changed).toBe(true)
    })

    it('keeps everyone and reports no change when all are fresh', () => {
      const result = prunePeers(peers, 1000, 5000)
      expect(result.peers.size).toBe(2)
      expect(result.changed).toBe(false)
    })
  })

  describe('collaboratorsFromPeers', () => {
    it('projects peers onto the Excalidraw collaborator shape', () => {
      const peers = new Map([
        [
          'peer-1',
          {
            username: 'Alice',
            color: { background: '#fff', stroke: '#000' },
            pointer: { x: 1, y: 2 },
            button: 'down'
          }
        ]
      ])

      const collaborators = collaboratorsFromPeers(peers)

      expect(collaborators.get('peer-1')).toEqual({
        id: 'peer-1',
        socketId: 'peer-1',
        username: 'Alice',
        color: { background: '#fff', stroke: '#000' },
        pointer: { x: 1, y: 2 },
        button: 'down'
      })
    })
  })
})
