import { useEffect } from 'react'

import {
  MESSAGE_TYPES,
  PEER_TTL_MS,
  PING_INTERVAL_MS,
  PRESENCE_SWEEP_MS,
  prunePeers
} from '@/modules/views/Excalidraw/collabProtocol'

/**
 * Drives the presence lifecycle while collaboration is live: a heartbeat ping so
 * peers keep seeing us, and a sweep that garbage-collects peers gone silent past
 * the TTL. On teardown it stops both timers and clears the room.
 *
 * @param {object} params
 * @param {boolean} params.active - Whether collaboration is live
 * @param {Function} params.sendMessage - (type, payload) => void
 * @param {{ current: Map<string, object> }} params.peersRef - The presence map ref
 * @param {Function} params.refresh - Re-render presence onto the canvas
 * @param {Function} params.setIsCollaborating - Toggles the collab badge
 */
export const usePresenceHeartbeat = ({
  active,
  sendMessage,
  peersRef,
  refresh,
  setIsCollaborating
}) => {
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
  }, [active, sendMessage, refresh, peersRef, setIsCollaborating])
}
