import { DOCTYPE_FILES } from '@/lib/doctypes'

const DOCTYPE_PERMISSIONS = 'io.cozy.permissions'

export const EU_DSS_SCHEME = 'eudss'
export const EU_DSS_SIGN = 'sign'
export const EU_DSS_VERIFY = 'verify'

// The signed document comes back as an ASiC-E container, the verification as a
// DSS simple report. The desktop app writes either back to the parent folder.
const SIGNED_FILE_EXTENSION = 'asice'
const VERIFICATION_REPORT_SUFFIX = '-verification.xml'

// cozy-stack invalidates the write permission after this delay, so the deeplink
// can only be used to push the result back for a short window.
const CALLBACK_PERMISSION_TTL = '10m'

const getCallbackFileName = (file, operation) =>
  operation === EU_DSS_VERIFY
    ? `${file.name}${VERIFICATION_REPORT_SUFFIX}`
    : `${file.name}.${SIGNED_FILE_EXTENSION}`

const fetchPublicDownloadUrl = async (client, file) => {
  const downloadPath = await client
    .collection(DOCTYPE_FILES, { driveId: file.driveId })
    .getDownloadLinkById(file._id, file.name)
  return client.getStackClient().fullpath(downloadPath)
}

const fetchCallbackToken = async (client, file) => {
  const { data: permission } = await client
    .collection(DOCTYPE_PERMISSIONS)
    .createSharingLink(
      { _id: file.dir_id, _type: DOCTYPE_FILES },
      { verbs: ['POST'], ttl: CALLBACK_PERMISSION_TTL }
    )
  return permission.attributes?.shortcodes?.code ?? null
}

// Files inside a shared drive live behind the /sharings/drives/<driveId>
// proxy, so writing the result back must target that route instead of the
// member's own VFS (which does not hold the document).
const getFilesApiPrefix = file =>
  file.driveId ? `/sharings/drives/${file.driveId}/files` : '/files'

// cozy-stack only authenticates via the Authorization header, never a query
// param. The token is passed in the URL by convention: the eu-dss desktop app
// reads it and replays it as a Bearer header on its POST to the callback.
const buildCallbackUrl = (client, file, operation, token) => {
  const stackUri = client.getStackClient().uri
  const params = new URLSearchParams({
    Type: 'file',
    Name: getCallbackFileName(file, operation),
    token
  })
  return `${stackUri}${getFilesApiPrefix(file)}/${file.dir_id}?${params}`
}

export const buildEuDssDeeplink = async (client, file, operation) => {
  const docUrl = await fetchPublicDownloadUrl(client, file)
  const token = await fetchCallbackToken(client, file)
  const callbackUrl = buildCallbackUrl(client, file, operation, token)

  const params = new URLSearchParams({
    doc_url: docUrl,
    callback_url: callbackUrl,
    state: file._id
  })
  return `${EU_DSS_SCHEME}://${operation}?${params}`
}
