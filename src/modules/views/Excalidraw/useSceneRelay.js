import {
  CaptureUpdateAction,
  getSceneVersion,
  reconcileElements,
  restoreElements
} from '@excalidraw/excalidraw'
import { useCallback, useRef } from 'react'

import { MESSAGE_TYPES } from '@/modules/views/Excalidraw/collabProtocol'

/**
 * Relays scene edits to and from the room. Element merging is last-write-wins
 * via reconcileElements (no OT, no CRDT, no server merge), and a version
 * watermark stops a remote update we just applied from being echoed back.
 *
 * @param {object} params
 * @param {{ current: object|null }} params.apiRef - Ref to the Excalidraw imperative API
 * @param {boolean} params.isReadOnly - A viewer never broadcasts its edits
 * @param {Function} params.sendMessage - (type, payload, targetId) => void
 * @param {() => boolean} params.hasPeers - Whether anyone else is in the room
 * @returns {{
 *   applyRemoteScene: Function, broadcastScene: Function,
 *   broadcastInitTo: Function, reset: Function
 * }}
 */
export const useSceneRelay = ({
  apiRef,
  isReadOnly,
  sendMessage,
  hasPeers
}) => {
  const lastBroadcastVersionRef = useRef(-1)
  const knownFileIdsRef = useRef(new Set())

  // Merge a remote scene (live update or initial handshake) into the canvas.
  const applyRemoteScene = useCallback(
    payload => {
      const api = apiRef.current
      if (!api || !payload) return
      const remote = restoreElements(payload.elements || [], null)
      const reconciled = reconcileElements(
        api.getSceneElements(),
        remote,
        api.getAppState()
      )
      const fileEntries = payload.files ? Object.entries(payload.files) : []
      if (fileEntries.length) {
        // Add the images first so the elements referencing them resolve, and
        // mark them known only once addFiles accepted them — otherwise a throw
        // on malformed data would suppress them forever.
        api.addFiles(fileEntries.map(([, fileData]) => fileData))
        fileEntries.forEach(([id]) => knownFileIdsRef.current.add(id))
      }
      api.updateScene({
        elements: reconciled,
        captureUpdate: CaptureUpdateAction.NEVER
      })
      // Watermark from the version the canvas actually settled on, so the
      // onChange this triggers is recognised as remote and not echoed back.
      lastBroadcastVersionRef.current = getSceneVersion(api.getSceneElements())
    },
    [apiRef]
  )

  // Embedded images added since the last broadcast, so steady-state element
  // updates stay light while new images still propagate as they appear.
  const collectNewFiles = useCallback(() => {
    const api = apiRef.current
    if (!api) return undefined
    const files = api.getFiles() || {}
    const added = {}
    let hasNew = false
    for (const [id, fileData] of Object.entries(files)) {
      if (!knownFileIdsRef.current.has(id)) {
        knownFileIdsRef.current.add(id)
        added[id] = fileData
        hasNew = true
      }
    }
    return hasNew ? added : undefined
  }, [apiRef])

  const broadcastScene = useCallback(
    elements => {
      if (isReadOnly) return
      const version = getSceneVersion(elements)
      // The first onChange after mount reflects the loaded scene: baseline it so
      // the initial state is not blasted to the room (newcomers get it via the
      // SCENE_INIT handshake instead).
      if (lastBroadcastVersionRef.current < 0) {
        lastBroadcastVersionRef.current = version
        return
      }
      // Only a genuine local edit pushes the version strictly past what we last
      // sent or applied. Equal-or-lower versions are echoes of our own
      // updateScene calls — remote merges and collaborator-cursor renders — and
      // must never be rebroadcast, or two tabs ping-pong at network speed.
      if (version <= lastBroadcastVersionRef.current) return
      lastBroadcastVersionRef.current = version
      // Keep file-tracking in step with the version watermark even while alone,
      // so once peers arrive only genuinely new images are sent.
      const newFiles = collectNewFiles()
      if (!hasPeers()) return
      const payload = { elements }
      if (newFiles) payload.files = newFiles
      sendMessage(MESSAGE_TYPES.SCENE_UPDATE, payload)
    },
    [isReadOnly, hasPeers, sendMessage, collectNewFiles]
  )

  // Hand the full current scene to a single newcomer.
  const broadcastInitTo = useCallback(
    targetId => {
      const api = apiRef.current
      if (!api) return
      sendMessage(
        MESSAGE_TYPES.SCENE_INIT,
        { elements: api.getSceneElements(), files: api.getFiles() },
        targetId
      )
    },
    [apiRef, sendMessage]
  )

  const reset = useCallback(() => {
    lastBroadcastVersionRef.current = -1
    knownFileIdsRef.current = new Set()
  }, [])

  return { applyRemoteScene, broadcastScene, broadcastInitTo, reset }
}
