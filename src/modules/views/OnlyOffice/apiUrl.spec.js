import { makeOfficeApiUrl } from '@/modules/views/OnlyOffice/apiUrl'

describe('makeOfficeApiUrl', () => {
  it('should build the api url from a plain server url', () => {
    expect(makeOfficeApiUrl('https://office.example.org')).toBe(
      'https://office.example.org/web-apps/apps/api/documents/api.js'
    )
  })

  it('should tolerate a trailing slash', () => {
    expect(makeOfficeApiUrl('https://office.example.org/')).toBe(
      'https://office.example.org/web-apps/apps/api/documents/api.js'
    )
  })

  it('should keep a non default port', () => {
    expect(makeOfficeApiUrl('https://office.example.org:8443')).toBe(
      'https://office.example.org:8443/web-apps/apps/api/documents/api.js'
    )
  })

  it('should drop a query string used to swallow the api path', () => {
    expect(makeOfficeApiUrl('https://attacker.example.org/payload.js?')).toBe(
      'https://attacker.example.org/web-apps/apps/api/documents/api.js'
    )
  })

  it('should drop a fragment used to swallow the api path', () => {
    expect(makeOfficeApiUrl('https://attacker.example.org/payload.js#')).toBe(
      'https://attacker.example.org/web-apps/apps/api/documents/api.js'
    )
  })

  it('should drop a path pointing at an arbitrary resource', () => {
    expect(
      makeOfficeApiUrl(
        'https://victim.example.org/sharings/drives/x/downloads/y/p.js'
      )
    ).toBe('https://victim.example.org/web-apps/apps/api/documents/api.js')
  })

  it.each([
    'https://proxy.example:8443/onlyoffice',
    'https://proxy.example:8443/onlyoffice/',
    'https://proxy.example:8443/onlyoffice///',
    'https://user:password@proxy.example:8443/onlyoffice?ignored#ignored'
  ])('preserves a trusted server prefix without query or fragment: %s', url => {
    expect(makeOfficeApiUrl(url, { isServerUrlTrusted: true })).toBe(
      'https://proxy.example:8443/onlyoffice/web-apps/apps/api/documents/api.js'
    )
  })

  it('does not interpret a trusted path as another origin', () => {
    expect(
      makeOfficeApiUrl('https://proxy.example//onlyoffice', {
        isServerUrlTrusted: true
      })
    ).toBe(
      'https://proxy.example//onlyoffice/web-apps/apps/api/documents/api.js'
    )
  })

  it.each([
    'javascript:alert(1)//',
    'data:text/javascript,alert(1)',
    '/relative'
  ])('rejects an invalid URL even from a trusted source: %s', url => {
    expect(makeOfficeApiUrl(url, { isServerUrlTrusted: true })).toBe(null)
  })

  it('should reject a javascript url', () => {
    expect(makeOfficeApiUrl('javascript:alert(1)//')).toBe(null)
  })

  it('should reject a data url', () => {
    expect(makeOfficeApiUrl('data:text/javascript,alert(1)')).toBe(null)
  })

  it('should reject a value that is not an absolute url', () => {
    expect(makeOfficeApiUrl('/relative/path')).toBe(null)
    expect(makeOfficeApiUrl('')).toBe(null)
    expect(makeOfficeApiUrl(undefined)).toBe(null)
    expect(makeOfficeApiUrl(null)).toBe(null)
  })
})
