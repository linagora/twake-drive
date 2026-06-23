import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import { useCallback, useRef, useState } from 'react'

import {
  CURSOR_THROTTLE_MS,
  MESSAGE_TYPES,
  collaboratorsFromPeers,
  makePeerEntry,
  readPointer
} from '@/modules/views/Excalidraw/collabProtocol'
import { usePresenceHeartbeat } from '@/modules/views/Excalidraw/usePresenceHeartbeat'

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
    peersRef.current.set(
      message.senderId,
      makePeerEntry(existing, message, Date.now())
    )
  }, [])

  const removePeer = useCallback(senderId => {
    peersRef.current.delete(senderId)
  }, [])

  const updatePeerPointer = useCallback(message => {
    const peer = peersRef.current.get(message.senderId)
    if (!peer) return
    Object.assign(peer, readPointer(message.payload))
  }, [])

  const getPeerIds = useCallback(() => [...peersRef.current.keys()], [])

  const broadcastPointer = useCallback(
    payload => {
      // Broadcast even with no detected peer: a read-only viewer is invisible to
      // presence (it cannot POST a heartbeat) yet still renders our cursor. The
      // CURSOR_THROTTLE_MS cap keeps this bounded; the cost is a lone editor
      // streaming cursor moves that may have no receiver.
      if (!active) return
      const now = Date.now()
      if (now - lastPointerSentRef.current < CURSOR_THROTTLE_MS) return
      lastPointerSentRef.current = now
      sendMessage(MESSAGE_TYPES.MOUSE_LOCATION, readPointer(payload))
    },
    [active, sendMessage]
  )

  usePresenceHeartbeat({
    active,
    sendMessage,
    peersRef,
    refresh,
    setIsCollaborating
  })

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
