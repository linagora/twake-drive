import {
  CaptureUpdateAction,
  getSceneVersion,
  reconcileElements,
  restoreElements
} from '@excalidraw/excalidraw'
import { useCallback, useRef } from 'react'

import { MESSAGE_TYPES } from '@/modules/views/Excalidraw/collabProtocol'

// Merge a remote scene (live update or initial handshake) onto the canvas and
// return the version the canvas settled on, or null when there is nothing to
// apply. Kept out of the hook so its branching does not weigh on useSceneRelay.
const applyRemoteSceneToApi = (api, payload, knownFileIds) => {
  if (!api || !payload) return null
  const remote = restoreElements(payload.elements || [], null)
  const reconciled = reconcileElements(
    api.getSceneElements(),
    remote,
    api.getAppState()
  )
  const fileEntries = payload.files ? Object.entries(payload.files) : []
  if (fileEntries.length) {
    // Add the images first so the elements referencing them resolve, and mark
    // them known only once addFiles accepted them — otherwise a throw on
    // malformed data would suppress them forever.
    api.addFiles(fileEntries.map(([, fileData]) => fileData))
    fileEntries.forEach(([id]) => knownFileIds.add(id))
  }
  api.updateScene({
    elements: reconciled,
    captureUpdate: CaptureUpdateAction.NEVER
  })
  // Watermark over the elements *including* deleted ones, the same basis as the
  // onChange that broadcastScene reads. getSceneVersion sums per-element
  // versions, and a deletion keeps the tombstone (bumping the sum) while
  // getSceneElements() drops it — so watermarking from the non-deleted set would
  // sit permanently below the onChange version and every applied update would be
  // rebroadcast forever once anything is deleted.
  return getSceneVersion(api.getSceneElementsIncludingDeleted())
}

// Embedded images added since the last broadcast, so steady-state element
// updates stay light while new images still propagate as they appear.
const pickNewFiles = (api, knownFileIds) => {
  if (!api) return undefined
  const files = api.getFiles() || {}
  const added = {}
  let hasNew = false
  for (const [id, fileData] of Object.entries(files)) {
    if (!knownFileIds.has(id)) {
      knownFileIds.add(id)
      added[id] = fileData
      hasNew = true
    }
  }
  return hasNew ? added : undefined
}

/**
 * Relays scene edits to and from the room. Element merging is last-write-wins
 * via reconcileElements (no OT, no CRDT, no server merge), and a version
 * watermark stops a remote update we just applied from being echoed back.
 *
 * @param {object} params
 * @param {{ current: object|null }} params.apiRef - Ref to the Excalidraw imperative API
 * @param {boolean} params.isReadOnly - A viewer never broadcasts its edits
 * @param {Function} params.sendMessage - (type, payload, targetId) => void
 * @returns {{
 *   applyRemoteScene: Function, broadcastScene: Function,
 *   broadcastInitTo: Function, reset: Function
 * }}
 */
export const useSceneRelay = ({ apiRef, isReadOnly, sendMessage }) => {
  const lastBroadcastVersionRef = useRef(-1)
  const knownFileIdsRef = useRef(new Set())

  // Merge a remote scene (live update or initial handshake) into the canvas and
  // watermark from the version the canvas settled on, so the onChange this
  // triggers is recognised as remote and not echoed back.
  const applyRemoteScene = useCallback(
    payload => {
      const version = applyRemoteSceneToApi(
        apiRef.current,
        payload,
        knownFileIdsRef.current
      )
      if (version !== null) lastBroadcastVersionRef.current = version
    },
    [apiRef]
  )

  const collectNewFiles = useCallback(
    () => pickNewFiles(apiRef.current, knownFileIdsRef.current),
    [apiRef]
  )

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
      // Always broadcast a genuine edit. A read-only viewer (read share, public
      // link) has no POST on /realtime, so it can never announce itself and is
      // invisible to presence; gating on detected peers would freeze its canvas.
      // Broadcasting unconditionally keeps every subscriber, visible or not, in
      // sync (the cost is a lone editor posting updates nobody receives).
      const newFiles = collectNewFiles()
      const payload = { elements }
      if (newFiles) payload.files = newFiles
      sendMessage(MESSAGE_TYPES.SCENE_UPDATE, payload)
    },
    [isReadOnly, sendMessage, collectNewFiles]
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
