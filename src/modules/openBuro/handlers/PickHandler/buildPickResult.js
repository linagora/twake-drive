import { Q } from 'cozy-client'
import { makeSharingLink } from 'cozy-client/dist/models/sharing'

import {
  RESULT_DOWNLOAD_URL,
  RESULT_PAYLOAD,
  RESULT_SHARING_URL
} from '../../constants'

const FILES_DOCTYPE = 'io.cozy.files'

/**
 * WARNING — `payload` has no hard size limit. The OpenBuro spec lets the
 * client request inline base64 content via `type=payload`. Encoding a large
 * file synchronously here will allocate several copies of the bytes in
 * memory (fetch response → ArrayBuffer → base64 string → postMessage clone)
 * and can easily exhaust an iframe's memory for files of a few hundred MB.
 *
 * We intentionally do NOT cap this in code. The client is responsible for
 * only requesting `payload` when it knows the file is small enough to
 * handle inline. If this ever becomes a UX problem, enforce a limit here
 * and return `message: 'payload-too-large'`.
 */

const arrayBufferToBase64 = buffer => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const fetchPayload = async (downloadUrl, mimeType) => {
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(`payload fetch failed: ${response.status}`)
  }
  const buffer = await response.arrayBuffer()
  const base64 = arrayBufferToBase64(buffer)
  return `data:${mimeType};base64,${base64}`
}

/**
 * Resolve every selected file id into a full OpenBuro `result` entry with
 * metadata and the representations requested via `types`.
 *
 * Throws if any file or representation cannot be resolved — callers are
 * expected to turn that into a `resolution-failed` error message.
 *
 * @param {object} client - cozy-client instance
 * @param {string[]} ids - selected io.cozy.files ids
 * @param {string[]} types - requested representations (subset of
 *   {sharingUrl, downloadUrl, payload})
 * @returns {Promise<object[]>}
 */
export const buildPickResult = async (client, ids, types) => {
  const wantSharingUrl = types.includes(RESULT_SHARING_URL)
  const wantDownloadUrl = types.includes(RESULT_DOWNLOAD_URL)
  const wantPayload = types.includes(RESULT_PAYLOAD)

  return Promise.all(
    ids.map(async id => {
      const { data: file } = await client.query(Q(FILES_DOCTYPE).getById(id))
      const mimeType = file.mime
      const result = {
        name: file.name,
        mimeType,
        size: Number(file.size)
      }

      if (wantSharingUrl) {
        result.sharingUrl = await makeSharingLink(client, [id])
      }

      let downloadUrl
      if (wantDownloadUrl || wantPayload) {
        downloadUrl = await client
          .collection(FILES_DOCTYPE)
          .getDownloadLinkById(id, file.name)
      }
      if (wantDownloadUrl) {
        result.downloadUrl = downloadUrl
      }
      if (wantPayload) {
        result.payload = await fetchPayload(downloadUrl, mimeType)
      }

      return result
    })
  )
}
