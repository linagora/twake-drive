import { useCallback, useEffect, useRef } from 'react'

import { useClient } from 'cozy-client'

import logger from '@/lib/logger'
import {
  COLLAB_DOCTYPE,
  MESSAGE_TYPES,
  makeSessionId,
  shouldRespondToHello,
  unwrapMessage
} from '@/modules/views/Excalidraw/collabProtocol'
import { usePresence } from '@/modules/views/Excalidraw/usePresence'
import { useSceneRelay } from '@/modules/views/Excalidraw/useSceneRelay'

const REALTIME_EVENT = 'notified'

/**
 * Real-time Excalidraw collaboration over the cozy-stack realtime hub. The hub
 * is a blind relay (no merge, no storage), so this hook reconstructs the three
 * sub-protocols Socket.IO gave Excalidraw for free: presence ({@link usePresence}),
 * the new-arrival resync handshake, and auto-echo dedup. Element merging stays
 * last-write-wins in {@link useSceneRelay}.
 *
 * @param {object} params
 * @param {object} params.file - The io.cozy.files document being edited
 * @param {object|null} params.excalidrawAPI - The Excalidraw imperative API
 * @param {boolean} [params.isReadOnly] - A viewer receives and renders but never broadcasts edits
 * @param {boolean} [params.enabled] - Master switch (collab flag)
 * @param {string} [params.username] - Display name for this client's cursor
 * @returns {{ broadcastScene: Function, broadcastPointer: Function, isCollaborating: boolean }}
 */
export const useCollab = ({
  file,
  excalidrawAPI,
  isReadOnly = false,
  enabled = false,
  username = ''
}) => {
  const client = useClient()
  const fileId = file?._id
  const realtime = client?.plugins?.realtime
  // A read-only viewer (read share, public link) subscribes to receive, but its
  // sharecode has no POST on the file, so it never broadcasts — that keeps the
  // realtime endpoint from 403-ing on every cursor move.
  const active = Boolean(enabled && excalidrawAPI && fileId && realtime)
  const canSend = active && !isReadOnly

  // Unique per tab: the client-side substitute for Socket.IO's socket.id, used
  // as the presence key and the auto-echo filter.
  const sessionIdRef = useRef(null)
  if (sessionIdRef.current === null) sessionIdRef.current = makeSessionId()
  const sessionId = sessionIdRef.current

  // Kept in refs so the latest value is read without re-subscribing the socket.
  const apiRef = useRef(null)
  const usernameRef = useRef('')

  useEffect(() => {
    apiRef.current = excalidrawAPI
  }, [excalidrawAPI])
  useEffect(() => {
    usernameRef.current = username || ''
  }, [username])

  const sendMessage = useCallback(
    (type, payload, targetId) => {
      // Gate every send on `canSend`, so with collaboration off (no flag, API
      // not ready) or as a read-only viewer, editing never POSTs to /realtime.
      if (!canSend || !realtime || !fileId) return
      const message = {
        senderId: sessionId,
        username: usernameRef.current,
        type
      }
      if (payload !== undefined) message.payload = payload
      if (targetId !== undefined) message.targetId = targetId
      // RealtimePlugin.sendNotification returns undefined (not a promise), so
      // guard the call itself instead of chaining .catch on its result.
      try {
        realtime.sendNotification(COLLAB_DOCTYPE, fileId, message)
      } catch (error) {
        logger.warn(`Excalidraw collab send failed: ${error}`)
      }
    },
    [canSend, realtime, fileId, sessionId]
  )

  const {
    touchPeer,
    removePeer,
    updatePeerPointer,
    getPeerIds,
    refresh,
    broadcastPointer,
    isCollaborating
  } = usePresence({ apiRef, active, sendMessage })

  // No peers in the room → skip broadcasting edits entirely; a newcomer gets the
  // current scene through the SCENE_INIT handshake, not a steady stream.
  const hasPeers = useCallback(() => getPeerIds().length > 0, [getPeerIds])
  const { applyRemoteScene, broadcastScene, broadcastInitTo, reset } =
    useSceneRelay({ apiRef, isReadOnly, sendMessage, hasPeers })

  // Only the elected existing peer answers a newcomer, so a HELLO is resynced
  // once instead of once per peer.
  const respondToHello = useCallback(
    senderId => {
      if (shouldRespondToHello(sessionId, getPeerIds(), senderId)) {
        broadcastInitTo(senderId)
      }
    },
    [sessionId, getPeerIds, broadcastInitTo]
  )

  const handleMessage = useCallback(
    doc => {
      const message = unwrapMessage(doc)
      if (!message || message.senderId === sessionId) return // drop auto-echo
      // A leaving peer should not be resurrected by its own goodbye.
      if (message.type !== MESSAGE_TYPES.PRESENCE_BYE) touchPeer(message)

      switch (message.type) {
        case MESSAGE_TYPES.SCENE_UPDATE:
          applyRemoteScene(message.payload)
          break
        case MESSAGE_TYPES.SCENE_INIT:
          if (message.targetId === sessionId) applyRemoteScene(message.payload)
          break
        case MESSAGE_TYPES.MOUSE_LOCATION:
          updatePeerPointer(message)
          break
        case MESSAGE_TYPES.PRESENCE_HELLO:
          respondToHello(message.senderId)
          break
        case MESSAGE_TYPES.PRESENCE_BYE:
          removePeer(message.senderId)
          break
        default:
          break // PRESENCE_PING: touchPeer already refreshed last-seen
      }
      refresh()
    },
    [
      sessionId,
      touchPeer,
      removePeer,
      updatePeerPointer,
      applyRemoteScene,
      respondToHello,
      refresh
    ]
  )

  useEffect(() => {
    if (!active) return undefined
    const handler = doc => handleMessage(doc)
    realtime.subscribe(REALTIME_EVENT, COLLAB_DOCTYPE, fileId, handler)
    sendMessage(MESSAGE_TYPES.PRESENCE_HELLO)
    return () => {
      sendMessage(MESSAGE_TYPES.PRESENCE_BYE)
      realtime.unsubscribe(REALTIME_EVENT, COLLAB_DOCTYPE, fileId, handler)
      reset()
    }
  }, [active, realtime, fileId, handleMessage, sendMessage, reset])

  return {
    broadcastScene,
    broadcastPointer,
    isCollaborating: enabled && isCollaborating
  }
}
