import { parseParams } from './parseParams'

describe('parseParams', () => {
  it('parses a full query-string with all params', () => {
    const search =
      '?clientUrl=https%3A%2F%2Fmail.alice.cozy&id=abc-123' +
      '&type=sharingUrl%2CdownloadUrl&allowedMimeType=image%2F*%2C.pdf&multiple=true'
    expect(parseParams(search)).toEqual({
      clientUrl: 'https://mail.alice.cozy',
      id: 'abc-123',
      type: ['sharingUrl', 'downloadUrl'],
      allowedMimeType: 'image/*,.pdf',
      multiple: true
    })
  })

  it('defaults `type` to every supported representation when absent', () => {
    expect(parseParams('?clientUrl=https%3A%2F%2Fa.example&id=x').type).toEqual(
      ['sharingUrl', 'downloadUrl', 'payload']
    )
  })

  it('defaults `multiple` to false when absent', () => {
    expect(
      parseParams('?clientUrl=https%3A%2F%2Fa.example&id=x').multiple
    ).toBe(false)
  })

  it('treats only the literal string "true" as `multiple` truthy', () => {
    const base = '?clientUrl=https%3A%2F%2Fa.example&id=x'
    expect(parseParams(`${base}&multiple=true`).multiple).toBe(true)
    expect(parseParams(`${base}&multiple=1`).multiple).toBe(false)
    expect(parseParams(`${base}&multiple=yes`).multiple).toBe(false)
    expect(parseParams(`${base}&multiple=false`).multiple).toBe(false)
  })

  it('defaults `allowedMimeType` to empty string when absent', () => {
    expect(
      parseParams('?clientUrl=https%3A%2F%2Fa.example&id=x').allowedMimeType
    ).toBe('')
  })

  it('filters out empty entries in `type`', () => {
    expect(
      parseParams(
        '?clientUrl=https%3A%2F%2Fa.example&id=x&type=sharingUrl%2C%2Cpayload'
      ).type
    ).toEqual(['sharingUrl', 'payload'])
  })

  it('returns `error: "missing-params"` when clientUrl is absent', () => {
    expect(parseParams('?id=abc-123')).toEqual({ error: 'missing-params' })
  })

  it('returns `error: "missing-params"` when id is absent', () => {
    expect(parseParams('?clientUrl=https%3A%2F%2Fa.example')).toEqual({
      error: 'missing-params'
    })
  })

  it('accepts an empty or missing search string as missing-params', () => {
    expect(parseParams('')).toEqual({ error: 'missing-params' })
    expect(parseParams(undefined)).toEqual({ error: 'missing-params' })
  })
})
