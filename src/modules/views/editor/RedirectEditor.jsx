import React from 'react'

import Loader from '@/components/Loader'
import { useEditorOpen } from '@/modules/views/editor/useEditorOpen'

/**
 * Mounts an editor only once the stack confirms the file lives on this
 * instance, and sends the user to its owner otherwise.
 *
 * `children` is created but never rendered while resolving, so the editor
 * joins no collaboration channel and autosaves nothing on a copy we are about
 * to leave.
 *
 * @param {object} params
 * @param {string} params.fileId - Id of the file to open, on this instance
 * @param {string} params.slug - The editor route prefix (e.g. "pdf", "excalidraw")
 * @param {string} [params.driveId] - Shared drive the file belongs to
 * @param {React.ReactNode} params.children - The editor to mount
 * @returns {React.ReactElement}
 */
export const RedirectEditor = ({ fileId, slug, driveId, children }) => {
  const openStatus = useEditorOpen({ fileId, slug, driveId })

  return openStatus === 'local' ? children : <Loader />
}
