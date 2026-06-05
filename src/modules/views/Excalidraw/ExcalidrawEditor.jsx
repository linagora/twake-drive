// eslint-disable-next-line import/order -- must run before @excalidraw/excalidraw inits its asset path
import '@/modules/views/Excalidraw/setupAssetPath'
import { Excalidraw } from '@excalidraw/excalidraw'
// Since 0.18 the stylesheet is no longer auto-injected and must be imported.
import '@excalidraw/excalidraw/index.css'
import React, { useEffect } from 'react'

import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'

import Loader from '@/modules/views/Excalidraw/Loader'
// Imported after Excalidraw's stylesheet so our overrides win the cascade.
import '@/modules/views/Excalidraw/excalidrawOverrides.css'
import { useSceneSync } from '@/modules/views/Excalidraw/useSceneSync'

// The editor theme is driven by the Cozy theme, so the in-canvas theme toggle
// would be a dead control; hide it.
const UI_OPTIONS = { canvasActions: { toggleTheme: false } }

const ExcalidrawEditor = ({ file, flushRef, isReadOnly = false }) => {
  // Follow the Cozy theme (light, dark, or OS-driven) so the canvas matches the
  // top bar, like the rest of the app.
  const { type: theme } = useCozyTheme()
  const { status, scene, onChange, flush } = useSceneSync(file, {
    readOnly: isReadOnly
  })

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
        initialData={{
          elements: scene.elements,
          appState: scene.appState,
          files: scene.files
        }}
        theme={theme}
        UIOptions={UI_OPTIONS}
        viewModeEnabled={isReadOnly}
        onChange={isReadOnly ? undefined : onChange}
      />
    </div>
  )
}

export default ExcalidrawEditor
