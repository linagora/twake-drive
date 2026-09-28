import { redactUrl, redactEvent, redactBreadcrumb } from '@/lib/sentryScrub'

describe('redactUrl', () => {
  it('should drop the query string carrying the sharecode', () => {
    expect(
      redactUrl(
        'https://drive.example.org/public?sharecode=s3cr3t&username=bob'
      )
    ).toBe('https://drive.example.org/public')
  })

  it('should drop the fragment', () => {
    expect(redactUrl('https://drive.example.org/#/folder/abc?foo=1')).toBe(
      'https://drive.example.org/'
    )
  })

  it('should mask the secret of a download link', () => {
    expect(
      redactUrl('https://drive.example.org/files/downloads/s3cr3t/report.pdf')
    ).toBe('https://drive.example.org/files/downloads/[redacted]/report.pdf')
  })

  it('should mask the secret of a thumbnail link', () => {
    expect(redactUrl('/files/abc/thumbnails/s3cr3t/large')).toBe(
      '/files/abc/thumbnails/[redacted]/large'
    )
  })

  it('should leave a URL without secret untouched', () => {
    expect(redactUrl('https://drive.example.org/files/abc')).toBe(
      'https://drive.example.org/files/abc'
    )
  })

  it('should return a non string input untouched', () => {
    expect(redactUrl(undefined)).toBe(undefined)
    expect(redactUrl(null)).toBe(null)
  })
})

describe('redactEvent', () => {
  it('should redact the request url, its query string and its referer', () => {
    const event = redactEvent({
      request: {
        url: 'https://drive.example.org/public?sharecode=s3cr3t',
        query_string: 'sharecode=s3cr3t',
        headers: {
          Referer: 'https://drive.example.org/preview?sharecode=s3cr3t'
        }
      }
    })

    expect(event.request.url).toBe('https://drive.example.org/public')
    expect(event.request.query_string).toBe(undefined)
    expect(event.request.headers.Referer).toBe(
      'https://drive.example.org/preview'
    )
  })

  it('should redact urls carried by breadcrumbs and spans', () => {
    const event = redactEvent({
      breadcrumbs: [
        { data: { url: '/files/downloads/s3cr3t/report.pdf' } },
        { data: { from: '/a?sharecode=s3cr3t', to: '/b?sharecode=s3cr3t' } }
      ],
      spans: [
        {
          description: 'GET /files/downloads/s3cr3t/report.pdf',
          data: { url: '/public?sharecode=s3cr3t' }
        }
      ]
    })

    expect(event.breadcrumbs[0].data.url).toBe(
      '/files/downloads/[redacted]/report.pdf'
    )
    expect(event.breadcrumbs[1].data.from).toBe('/a')
    expect(event.breadcrumbs[1].data.to).toBe('/b')
    expect(event.spans[0].description).toBe(
      'GET /files/downloads/[redacted]/report.pdf'
    )
    expect(event.spans[0].data.url).toBe('/public')
  })

  it('should redact the http.url span attribute set by the tracing integration', () => {
    // The fetch and xhr instrumentations store the resolved URL under
    // `http.url`, which keeps the query string.
    const event = redactEvent({
      spans: [
        {
          data: {
            url: '/files/downloads/s3cr3t/report.pdf',
            'http.url':
              'https://drive.example.org/files/downloads/s3cr3t/report.pdf'
          }
        },
        {
          data: {
            'http.url': 'https://drive.example.org/public?sharecode=s3cr3t'
          }
        }
      ]
    })

    expect(event.spans[0].data['http.url']).toBe(
      'https://drive.example.org/files/downloads/[redacted]/report.pdf'
    )
    expect(event.spans[1].data['http.url']).toBe(
      'https://drive.example.org/public'
    )
  })

  it('should redact the span name, which carries the url', () => {
    const event = redactEvent({
      spans: [{ name: 'GET /public?sharecode=s3cr3t' }]
    })

    expect(event.spans[0].name).toBe('GET /public')
  })

  it('should redact http.url carried by a breadcrumb', () => {
    const event = redactEvent({
      breadcrumbs: [{ data: { 'http.url': '/public?sharecode=s3cr3t' } }]
    })

    expect(event.breadcrumbs[0].data['http.url']).toBe('/public')
  })

  it('should handle an event without request, breadcrumbs nor spans', () => {
    expect(redactEvent({})).toEqual({})
  })
})

describe('redactBreadcrumb', () => {
  it('should redact the breadcrumb url', () => {
    expect(
      redactBreadcrumb({ data: { url: '/public?sharecode=s3cr3t' } }).data.url
    ).toBe('/public')
  })

  it('should return a breadcrumb without data untouched', () => {
    expect(redactBreadcrumb({ category: 'ui.click' })).toEqual({
      category: 'ui.click'
    })
  })
})
