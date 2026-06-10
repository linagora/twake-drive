import { useCallback } from 'react'

import logger from '@/lib/logger'
import { COLLAB_DOCTYPE } from '@/modules/views/Excalidraw/collabProtocol'

/**
 * Builds the single send primitive every sub-protocol uses. Sends are gated so
 * that with collaboration off (no flag, API not ready) or as a read-only viewer
 * — which subscribes to receive but has no POST on the file — editing never
 * POSTs to /realtime, keeping the endpoint from 403-ing on every cursor move.
 *
 * @param {object} params
 * @param {boolean} params.active - Whether collaboration is live
 * @param {boolean} params.isReadOnly - A viewer receives but never broadcasts
 * @param {object} params.realtime - The cozy-client realtime plugin
 * @param {string} params.fileId - The room id (io.cozy.files id being edited)
 * @param {{ current: string }} params.sessionIdRef - Ref to this tab's session id (auto-echo filter)
 * @param {{ current: string }} params.usernameRef - Ref to the live display name
 * @returns {(type: string, payload?: object, targetId?: string) => void}
 */
export const useCollabSender = ({
  active,
  isReadOnly,
  realtime,
  fileId,
  sessionIdRef,
  usernameRef
}) => {
  const canSend = active && !isReadOnly
  return useCallback(
    (type, payload, targetId) => {
      if (!canSend || !realtime || !fileId) return
      const message = {
        senderId: sessionIdRef.current,
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
    [canSend, realtime, fileId, sessionIdRef, usernameRef]
  )
}
