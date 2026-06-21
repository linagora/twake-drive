import { buildEuDssDeeplink, EU_DSS_SIGN, EU_DSS_VERIFY } from './euDss'

const setupClient = () => {
  const getDownloadLinkById = jest
    .fn()
    .mockResolvedValue('/files/downloads/secret/contract.pdf')
  const createSharingLink = jest.fn().mockResolvedValue({
    data: { attributes: { shortcodes: { code: 'TOKEN123' } } }
  })
  const client = {
    collection: jest.fn(doctype =>
      doctype === 'io.cozy.permissions'
        ? { createSharingLink }
        : { getDownloadLinkById }
    ),
    getStackClient: () => ({
      uri: 'http://cozy.tools',
      fullpath: path =>
        path.startsWith('http') ? path : 'http://cozy.tools' + path
    })
  }
  return { client, getDownloadLinkById, createSharingLink }
}

const file = {
  _id: 'file-123',
  name: 'contract.pdf',
  dir_id: 'dir-456'
}

const getQueryParams = deeplink =>
  new URLSearchParams(deeplink.substring(deeplink.indexOf('?') + 1))

describe('buildEuDssDeeplink', () => {
  it('targets the eudss sign endpoint', async () => {
    const { client } = setupClient()

    const deeplink = await buildEuDssDeeplink(client, file, EU_DSS_SIGN)

    expect(deeplink.startsWith('eudss://sign?')).toBe(true)
  })

  it('embeds the public download link as doc_url', async () => {
    const { client, getDownloadLinkById } = setupClient()

    const deeplink = await buildEuDssDeeplink(client, file, EU_DSS_SIGN)

    expect(getDownloadLinkById).toHaveBeenCalledWith('file-123', 'contract.pdf')
    expect(getQueryParams(deeplink).get('doc_url')).toBe(
      'http://cozy.tools/files/downloads/secret/contract.pdf'
    )
  })

  it('requests a short-lived write permission on the parent folder', async () => {
    const { client, createSharingLink } = setupClient()

    await buildEuDssDeeplink(client, file, EU_DSS_SIGN)

    expect(createSharingLink).toHaveBeenCalledWith(
      { _id: 'dir-456', _type: 'io.cozy.files' },
      { verbs: ['POST'], ttl: '10m' }
    )
  })

  it('embeds the write token and the signed file name in callback_url', async () => {
    const { client } = setupClient()

    const deeplink = await buildEuDssDeeplink(client, file, EU_DSS_SIGN)

    const callbackUrl = new URL(getQueryParams(deeplink).get('callback_url'))
    expect(callbackUrl.origin + callbackUrl.pathname).toBe(
      'http://cozy.tools/files/dir-456'
    )
    expect(callbackUrl.searchParams.get('Type')).toBe('file')
    expect(callbackUrl.searchParams.get('Name')).toBe('contract.pdf.asice')
    expect(callbackUrl.searchParams.get('token')).toBe('TOKEN123')
  })

  it('writes an xml report on verify', async () => {
    const { client } = setupClient()

    const deeplink = await buildEuDssDeeplink(client, file, EU_DSS_VERIFY)

    expect(deeplink.startsWith('eudss://verify?')).toBe(true)
    const callbackUrl = new URL(getQueryParams(deeplink).get('callback_url'))
    expect(callbackUrl.searchParams.get('Name')).toBe(
      'contract.pdf-verification.xml'
    )
  })

  it('sets state to the file id for correlation', async () => {
    const { client } = setupClient()

    const deeplink = await buildEuDssDeeplink(client, file, EU_DSS_SIGN)

    expect(getQueryParams(deeplink).get('state')).toBe('file-123')
  })
})
