import { useEffect, useRef } from 'react'

import { useClient } from 'cozy-client'

import {
  COLLAB_DOCTYPE,
  MESSAGE_TYPES,
  makeSessionId
} from '@/modules/views/Excalidraw/collabProtocol'
import { useCollabRouter } from '@/modules/views/Excalidraw/useCollabRouter'
import { useCollabSender } from '@/modules/views/Excalidraw/useCollabSender'
import { usePresence } from '@/modules/views/Excalidraw/usePresence'
import { useSceneRelay } from '@/modules/views/Excalidraw/useSceneRelay'

const REALTIME_EVENT = 'notified'

// Collaboration only goes live once the flag is on, the canvas API is mounted,
// we have a file to key the room on, and the realtime plugin exists.
const isCollabReady = (enabled, excalidrawAPI, fileId, realtime) =>
  Boolean(enabled && excalidrawAPI && fileId && realtime)

/**
 * Real-time Excalidraw collaboration over the cozy-stack realtime hub. The hub
 * is a blind relay (no merge, no storage), so this hook reconstructs the three
 * sub-protocols Socket.IO gave Excalidraw for free: presence ({@link usePresence}),
 * the new-arrival resync handshake ({@link useCollabRouter}), and auto-echo
 * dedup. Element merging stays last-write-wins in {@link useSceneRelay}, and
 * every broadcast goes through the gated {@link useCollabSender}.
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
  const active = isCollabReady(enabled, excalidrawAPI, fileId, realtime)

  // Unique per tab: the client-side substitute for Socket.IO's socket.id, used
  // as the presence key and the auto-echo filter. Kept in a ref (read only from
  // deferred callbacks) so it survives re-renders without a new identity.
  const sessionIdRef = useRef(null)
  if (sessionIdRef.current === null) sessionIdRef.current = makeSessionId()

  // Kept in a ref so the latest name is read without re-subscribing the socket.
  const apiRef = useRef(null)
  const usernameRef = useRef('')
  useEffect(() => {
    apiRef.current = excalidrawAPI
  }, [excalidrawAPI])
  useEffect(() => {
    usernameRef.current = username || ''
  }, [username])

  const sendMessage = useCollabSender({
    active,
    isReadOnly,
    realtime,
    fileId,
    sessionIdRef,
    usernameRef
  })

  const {
    touchPeer,
    removePeer,
    updatePeerPointer,
    getPeerIds,
    refresh,
    broadcastPointer,
    isCollaborating
  } = usePresence({ apiRef, active, sendMessage })

  const { applyRemoteScene, broadcastScene, broadcastInitTo, reset } =
    useSceneRelay({ apiRef, isReadOnly, sendMessage })

  const handleMessage = useCollabRouter({
    sessionIdRef,
    touchPeer,
    removePeer,
    updatePeerPointer,
    getPeerIds,
    applyRemoteScene,
    broadcastInitTo,
    refresh
  })

  // Re-baseline the relay only when the document itself changes — not on every
  // re-subscribe. Tying reset to the subscription's teardown meant any unrelated
  // effect rerun re-armed the watermark sentinel, so the next edit was taken for
  // the loaded-scene baseline and silently never broadcast.
  useEffect(() => {
    reset()
  }, [reset, fileId])

  useEffect(() => {
    if (!active) return undefined
    const handler = doc => handleMessage(doc)
    realtime.subscribe(REALTIME_EVENT, COLLAB_DOCTYPE, fileId, handler)
    sendMessage(MESSAGE_TYPES.PRESENCE_HELLO)
    return () => {
      sendMessage(MESSAGE_TYPES.PRESENCE_BYE)
      realtime.unsubscribe(REALTIME_EVENT, COLLAB_DOCTYPE, fileId, handler)
    }
  }, [active, realtime, fileId, handleMessage, sendMessage])

  return {
    broadcastScene,
    broadcastPointer,
    isCollaborating: enabled && isCollaborating
  }
}
