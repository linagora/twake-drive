import { useCallback } from 'react'

import {
  MESSAGE_TYPES,
  shouldRespondToHello,
  unwrapMessage
} from '@/modules/views/Excalidraw/collabProtocol'

// Dispatches a decoded message to the matching sub-protocol action. Kept at
// module scope so the per-type fan-out does not weigh on useCollabRouter.
const routeByType = (message, actions) => {
  switch (message.type) {
    case MESSAGE_TYPES.SCENE_UPDATE:
      actions.applyRemoteScene(message.payload)
      break
    case MESSAGE_TYPES.SCENE_INIT:
      actions.applyInit(message)
      break
    case MESSAGE_TYPES.MOUSE_LOCATION:
      actions.updatePeerPointer(message)
      break
    case MESSAGE_TYPES.PRESENCE_HELLO:
      actions.respondToHello(message.senderId)
      break
    case MESSAGE_TYPES.PRESENCE_BYE:
      actions.removePeer(message.senderId)
      break
    default:
      break // PRESENCE_PING: touchPeer already refreshed last-seen
  }
}

/**
 * Routes incoming realtime messages to presence and scene-relay actions. The
 * cozy hub auto-echoes a sender's own POST, so the handler drops messages from
 * this session, then refreshes presence and dispatches by type.
 *
 * @param {object} params
 * @param {{ current: string }} params.sessionIdRef - Ref to this tab's session id
 * @param {Function} params.touchPeer - Refresh a peer's identity / last-seen
 * @param {Function} params.removePeer - Drop a peer that said goodbye
 * @param {Function} params.updatePeerPointer - Move a peer's cursor
 * @param {() => string[]} params.getPeerIds - Session ids currently in the room
 * @param {Function} params.applyRemoteScene - Merge a remote scene payload
 * @param {Function} params.broadcastInitTo - Hand the full scene to a newcomer
 * @param {Function} params.refresh - Re-render presence onto the canvas
 * @returns {(doc: object) => void} The realtime message handler
 */
export const useCollabRouter = ({
  sessionIdRef,
  touchPeer,
  removePeer,
  updatePeerPointer,
  getPeerIds,
  applyRemoteScene,
  broadcastInitTo,
  refresh
}) => {
  // Only the elected existing peer answers a newcomer, so a HELLO is resynced
  // once instead of once per peer.
  const respondToHello = useCallback(
    senderId => {
      if (shouldRespondToHello(sessionIdRef.current, getPeerIds(), senderId)) {
        broadcastInitTo(senderId)
      }
    },
    [sessionIdRef, getPeerIds, broadcastInitTo]
  )

  // A SCENE_INIT is the full scene handed to a single newcomer; ignore one
  // addressed to another session.
  const applyInit = useCallback(
    message => {
      if (message.targetId === sessionIdRef.current) {
        applyRemoteScene(message.payload)
      }
    },
    [sessionIdRef, applyRemoteScene]
  )

  return useCallback(
    doc => {
      const message = unwrapMessage(doc)
      // Drop auto-echo: the cozy hub relays our own POST back to us.
      if (!message || message.senderId === sessionIdRef.current) return
      // A leaving peer should not be resurrected by its own goodbye.
      if (message.type !== MESSAGE_TYPES.PRESENCE_BYE) touchPeer(message)
      routeByType(message, {
        applyRemoteScene,
        applyInit,
        updatePeerPointer,
        respondToHello,
        removePeer
      })
      refresh()
    },
    [
      sessionIdRef,
      touchPeer,
      removePeer,
      updatePeerPointer,
      applyRemoteScene,
      applyInit,
      respondToHello,
      refresh
    ]
  )
}
