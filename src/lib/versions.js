/**
 * Permanently remove an old version of a file's content.
 *
 * An `io.cozy.files.versions` id is already shaped as `fileId/versionId`, which
 * is exactly what `DELETE /files/:file-id/:version-id` expects. The collection
 * prefix resolves to the shared drive route when a driveId is given.
 *
 * @param {object} params
 * @param {import('cozy-client').default} params.client
 * @param {string} [params.driveId] Id of the shared drive holding the file
 * @param {object} params.version io.cozy.files.versions document
 */
export const destroyFileVersion = async ({ client, driveId, version }) => {
  const { prefix } = client.collection('io.cozy.files', { driveId })

  return client.getStackClient().fetchJSON('DELETE', `${prefix}/${version.id}`)
}
