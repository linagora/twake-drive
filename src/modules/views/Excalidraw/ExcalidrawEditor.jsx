// eslint-disable-next-line import/order -- must run before @excalidraw/excalidraw inits its asset path
import '@/modules/views/Excalidraw/setupAssetPath'
import { Excalidraw } from '@excalidraw/excalidraw'
// Since 0.18 the stylesheet is no longer auto-injected and must be imported.
import '@excalidraw/excalidraw/index.css'
import React, { useCallback, useEffect, useState } from 'react'

import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'

import Loader from '@/components/Loader'
// Imported after Excalidraw's stylesheet so our overrides win the cascade.
import '@/modules/views/Excalidraw/excalidrawOverrides.css'
import { isExcalidrawCollabEnabled } from '@/modules/views/Excalidraw/helpers'
import { useCollab } from '@/modules/views/Excalidraw/useCollab'
import { useCollabUsername } from '@/modules/views/Excalidraw/useCollabUsername'
import { useSceneSync } from '@/modules/views/Excalidraw/useSceneSync'

// The editor theme is driven by the Cozy theme, so the in-canvas theme toggle
// would be a dead control; hide it.
const UI_OPTIONS = { canvasActions: { toggleTheme: false } }

const ExcalidrawEditor = ({
  file,
  flushRef,
  isReadOnly = false,
  isPublic = false
}) => {
  // Follow the Cozy theme (light, dark, or OS-driven) so the canvas matches the
  // top bar, like the rest of the app.
  const { type: theme } = useCozyTheme()
  const [excalidrawAPI, setExcalidrawAPI] = useState(null)
  const { status, scene, onChange, flush } = useSceneSync(file, {
    readOnly: isReadOnly
  })

  // Collaboration relays edits through the instance realtime hub on the
  // io.cozy.files channel, which a public-share guest can reach too — so it is
  // enabled in both private and public contexts (read-only viewers receive
  // only). It still works only between users of the same instance.
  const collabEnabled = isExcalidrawCollabEnabled()
  const username = useCollabUsername({ isPublic })
  const { broadcastScene, broadcastPointer, isCollaborating } = useCollab({
    file,
    excalidrawAPI,
    isReadOnly,
    enabled: collabEnabled,
    username
  })

  // Every edit feeds both the autosave (the file is the source of truth) and the
  // live room.
  const handleChange = useCallback(
    (elements, appState, files) => {
      onChange(elements, appState, files)
      broadcastScene(elements)
    },
    [onChange, broadcastScene]
  )

  // Expose the autosave flush so the toolbar back button can force a save before
  // navigating away.
  useEffect(() => {
    if (!flushRef) return undefined
    flushRef.current = flush
    return () => {
      flushRef.current = null
    }
  }, [flush, flushRef])

  if (status !== 'loaded') {
    return <Loader />
  }

  return (
    <div className="excalidraw-editor u-flex u-flex-grow-1 u-w-100">
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        initialData={{
          elements: scene.elements,
          appState: scene.appState,
          files: scene.files
        }}
        theme={theme}
        UIOptions={UI_OPTIONS}
        viewModeEnabled={isReadOnly}
        isCollaborating={isCollaborating}
        onChange={isReadOnly ? undefined : handleChange}
        onPointerUpdate={collabEnabled ? broadcastPointer : undefined}
      />
    </div>
  )
}

export default ExcalidrawEditor
