import { getSceneVersion, serializeAsJSON } from '@excalidraw/excalidraw'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useClient } from 'cozy-client'

import logger from '@/lib/logger'
import {
  EXCALIDRAW_MIME,
  isExcalidrawScene,
  makeEmptyScene
} from '@/modules/views/Excalidraw/helpers'

const DEFAULT_INTERVAL_MS = 10000

// The scene IS the file: a .excalidraw is a JSON file. The 'local' type produces
// the exact format Excalidraw exports, keeping embedded images, so the file
// stays interoperable (download, desktop app, re-upload).
const serializeScene = ({ elements, appState, files }) =>
  serializeAsJSON(elements ?? [], appState ?? {}, files ?? {}, 'local')

const readSceneFromBinary = async (client, fileId, driveId) => {
  const response = await client
    .collection('io.cozy.files', driveId ? { driveId } : {})
    .fetchFileContentById(fileId)
  const text = await response.text()
  const scene = text ? JSON.parse(text) : makeEmptyScene()
  return isExcalidrawScene(scene) ? scene : makeEmptyScene()
}

const writeSceneToBinary = (client, file, content) =>
  client
    .collection('io.cozy.files', file.driveId ? { driveId: file.driveId } : {})
    .updateFile(content, {
      fileId: file._id,
      name: file.name,
      contentType: EXCALIDRAW_MIME
    })

// Cheap change signal: element version + persisted appState + the set of embedded
// file ids (so adding/removing an image is detected) — without serializing the
// whole scene, images included, on every onChange.
const sceneSignature = (elements, appState, files) =>
  `${getSceneVersion(elements)}:${serializeAsJSON(
    [],
    appState,
    {},
    'database'
  )}:${Object.keys(files || {})
    .sort()
    .join(',')}`

// Tracks scene edits and persists them on a fixed interval, on tab-hide, and on
// unmount. A failed save stays dirty and retries.
const useAutosave = (save, intervalMs) => {
  const lastSignature = useRef(null)
  const latestScene = useRef(null)
  const isDirty = useRef(false)

  const onChange = useCallback((elements, appState, files) => {
    const signature = sceneSignature(elements, appState, files)
    if (signature === lastSignature.current) return

    // The first onChange (fired by Excalidraw on mount) reflects the loaded
    // scene and is the baseline, not an edit.
    const isBaseline = lastSignature.current === null
    lastSignature.current = signature
    latestScene.current = { elements, appState, files }
    if (!isBaseline) isDirty.current = true
  }, [])

  const flush = useCallback(async () => {
    if (!isDirty.current) return
    isDirty.current = false
    try {
      await save(serializeScene(latestScene.current))
    } catch (error) {
      isDirty.current = true
      logger.error(`Saving Excalidraw scene failed: ${error}`)
    }
  }, [save])

  useEffect(() => {
    const intervalId = setInterval(flush, intervalMs)
    const handleHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', handleHide)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleHide)
      flush()
    }
  }, [flush, intervalMs])

  return { onChange, flush }
}

const noopSave = () => Promise.resolve()

// Loads the scene from the file binary once per file, falling back to an empty
// scene on any read error. The read is scoped to the shared drive just like the
// write path, so a drive-only recipient reads from /sharings/drives/<driveId>/
// files instead of /files (which 403s and would wipe the real drawing).
const useLoadedScene = (client, fileId, driveId) => {
  const [state, setState] = useState({ status: 'loading', scene: null })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let scene
      try {
        scene = await readSceneFromBinary(client, fileId, driveId)
      } catch (error) {
        logger.error(`Reading Excalidraw scene failed: ${error}`)
        scene = makeEmptyScene()
      }
      if (!cancelled) setState({ status: 'loaded', scene })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [client, fileId, driveId])

  return state
}

/**
 * Loads an Excalidraw scene from its file binary and keeps it autosaved back to
 * the binary. The scene is never duplicated into io.cozy.files metadata.
 *
 * @param {object} file - The io.cozy.files document being edited
 * @param {{ intervalMs?: number, readOnly?: boolean }} [options]
 * @returns {{ status: 'loading' | 'loaded', scene: object | null, onChange: Function, flush: () => Promise<void> }}
 */
export const useSceneSync = (
  file,
  { intervalMs = DEFAULT_INTERVAL_MS, readOnly = false } = {}
) => {
  const client = useClient()
  const state = useLoadedScene(client, file?._id, file?.driveId)

  const save = useCallback(
    content => writeSceneToBinary(client, file, content),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, file?._id, file?.name, file?.driveId]
  )
  const { onChange, flush } = useAutosave(
    readOnly ? noopSave : save,
    intervalMs
  )

  return { status: state.status, scene: state.scene, onChange, flush }
}
