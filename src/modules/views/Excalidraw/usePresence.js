import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  CURSOR_THROTTLE_MS,
  MESSAGE_TYPES,
  PEER_TTL_MS,
  PING_INTERVAL_MS,
  PRESENCE_SWEEP_MS,
  collaboratorsFromPeers,
  colorFromSessionId,
  prunePeers
} from '@/modules/views/Excalidraw/collabProtocol'

/**
 * Tracks who else is in the room and mirrors them onto the Excalidraw canvas.
 * The cozy hub does not track membership, so it is rebuilt from heartbeats:
 * peers are refreshed on every message and garbage-collected after the TTL.
 *
 * @param {object} params
 * @param {{ current: object|null }} params.apiRef - Ref to the Excalidraw imperative API
 * @param {boolean} params.active - Whether collaboration is live
 * @param {Function} params.sendMessage - (type, payload) => void
 * @returns {{
 *   touchPeer: Function, removePeer: Function, updatePeerPointer: Function,
 *   getPeerIds: () => string[], refresh: Function, broadcastPointer: Function,
 *   isCollaborating: boolean
 * }}
 */
export const usePresence = ({ apiRef, active, sendMessage }) => {
  const peersRef = useRef(new Map())
  const lastPointerSentRef = useRef(0)
  const [isCollaborating, setIsCollaborating] = useState(false)

  // Push the current peers onto the canvas and refresh the collab badge.
  const refresh = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    api.updateScene({
      collaborators: collaboratorsFromPeers(peersRef.current),
      captureUpdate: CaptureUpdateAction.NEVER
    })
    setIsCollaborating(peersRef.current.size > 0)
  }, [apiRef])

  // Refresh a peer's identity and last-seen on any message from it.
  const touchPeer = useCallback(message => {
    const existing = peersRef.current.get(message.senderId)
    peersRef.current.set(message.senderId, {
      ...existing,
      username: message.username || existing?.username || '',
      color: existing?.color || colorFromSessionId(message.senderId),
      lastSeen: Date.now()
    })
  }, [])

  const removePeer = useCallback(senderId => {
    peersRef.current.delete(senderId)
  }, [])

  const updatePeerPointer = useCallback(message => {
    const peer = peersRef.current.get(message.senderId)
    if (!peer) return
    peer.pointer = message.payload?.pointer
    peer.button = message.payload?.button
  }, [])

  const getPeerIds = useCallback(() => [...peersRef.current.keys()], [])

  const broadcastPointer = useCallback(
    payload => {
      // Nobody to show the cursor to → don't POST it. This silences cursor
      // traffic entirely while editing alone, the common case.
      if (!active || peersRef.current.size === 0) return
      const now = Date.now()
      if (now - lastPointerSentRef.current < CURSOR_THROTTLE_MS) return
      lastPointerSentRef.current = now
      sendMessage(MESSAGE_TYPES.MOUSE_LOCATION, {
        pointer: payload?.pointer,
        button: payload?.button
      })
    },
    [active, sendMessage]
  )

  useEffect(() => {
    if (!active) return undefined
    const pingId = setInterval(
      () => sendMessage(MESSAGE_TYPES.PRESENCE_PING),
      PING_INTERVAL_MS
    )
    const sweepId = setInterval(() => {
      const { peers, changed } = prunePeers(
        peersRef.current,
        Date.now(),
        PEER_TTL_MS
      )
      if (changed) {
        peersRef.current = peers
        refresh()
      }
    }, PRESENCE_SWEEP_MS)
    return () => {
      clearInterval(pingId)
      clearInterval(sweepId)
      peersRef.current = new Map()
      setIsCollaborating(false)
    }
  }, [active, sendMessage, refresh])

  return {
    touchPeer,
    removePeer,
    updatePeerPointer,
    getPeerIds,
    refresh,
    broadcastPointer,
    isCollaborating
  }
}
