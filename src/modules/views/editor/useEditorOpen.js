import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useClient } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'

import { changeLocation } from '@/hooks/helpers'
import logger from '@/lib/logger'
import {
  makePublicEditorUrl,
  shouldBeOpenedOnOtherInstance
} from '@/modules/views/editor/helpers'

const makeOpenPath = (fileId, driveId) =>
  driveId
    ? `/sharings/drives/${driveId}/editor/${fileId}/open`
    : `/editor/${fileId}/open`

// A stack without the route, or a file it cannot resolve, must not take the
// editor down: fall back to the local copy, as every open did before.
const computeStatus = ({ fetchStatus, data, instanceUri }) => {
  if (fetchStatus !== 'loaded' && fetchStatus !== 'error') return 'loading'
  if (fetchStatus === 'error' || !data) return 'local'

  return shouldBeOpenedOnOtherInstance(data, instanceUri)
    ? 'redirecting'
    : 'local'
}

/**
 * Asks the stack where a file must be opened and, for a shared document, sends
 * the user to the instance that owns it.
 *
 * The caller must not mount the editor until this returns 'local': the editor
 * joins the collaboration channel and autosaves as soon as it mounts, which
 * would write to the copy we are about to leave.
 *
 * @param {object} params
 * @param {string} params.fileId - Id of the file to open, on this instance
 * @param {string} params.slug - The editor route prefix (e.g. "pdf", "excalidraw")
 * @param {string} [params.driveId] - Shared drive the file belongs to
 * @returns {'loading'|'local'|'redirecting'}
 */
export const useEditorOpen = ({ fileId, slug, driveId }) => {
  const client = useClient()
  const [searchParams] = useSearchParams()
  const redirectedTo = useRef(null)

  const instanceUri = client?.getStackClient().uri
  const { data, fetchStatus } = useFetchJSON(
    'GET',
    makeOpenPath(fileId, driveId)
  )

  const status = computeStatus({ fetchStatus, data, instanceUri })

  useEffect(() => {
    if (fetchStatus !== 'error') return
    logger.warn(`Cannot resolve where to open ${fileId}, opening it locally`)
  }, [fetchStatus, fileId])

  useEffect(() => {
    if (status !== 'redirecting') return

    const { file_id } = data.data.attributes
    const url = makePublicEditorUrl({
      attributes: data.data.attributes,
      hash: `/${slug}/${file_id}`,
      redirectLink: searchParams.get('redirectLink')
    })

    // Keyed on the target rather than on a single redirect having happened: the
    // route reuses this view when its params change, so another shared file has
    // to be able to redirect in turn.
    if (redirectedTo.current === url) return
    redirectedTo.current = url

    changeLocation(url)
  }, [status, data, searchParams, slug])

  return status
}
