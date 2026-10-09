import {
  makeCapabilities,
  normalizeFolderName
} from '@/modules/views/Drive/Assistant/capabilities'

const t = key => `t(${key})`

describe('makeCapabilities', () => {
  it('lets the assistant create a folder, with a translated label', () => {
    const capabilities = makeCapabilities({ t })

    expect(capabilities.map(capability => capability.name)).toEqual([
      'create_folder'
    ])
    capabilities.forEach(capability => {
      expect(capability.name).toMatch(/^[a-z][a-z0-9_]{0,39}$/)
      expect(capability.examples.length).toBeLessThanOrEqual(5)
    })
    expect(capabilities[0]).toMatchObject({
      label: 't(Assistant.createFolder)',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name']
      },
      instructions: expect.any(String)
    })
    expect(capabilities[0]).not.toHaveProperty('content')
  })
})

describe('normalizeFolderName', () => {
  it('gives the name of the folder', () => {
    expect(normalizeFolderName({ name: 'Factures 2026' })).toBe('Factures 2026')
  })

  it('leaves out the spaces, the slashes and the dots around', () => {
    expect(normalizeFolderName({ name: '  Factures  ' })).toBe('Factures')
    expect(normalizeFolderName({ name: 'Factures/2026' })).toBe('Factures 2026')
    expect(normalizeFolderName({ name: '\\Factures\\' })).toBe('Factures')
    expect(normalizeFolderName({ name: '. Factures.' })).toBe('Factures')
    expect(normalizeFolderName({ name: 'v1.2 notes' })).toBe('v1.2 notes')
  })

  it('cuts a long name at 100 characters, without a space left at the end', () => {
    expect(normalizeFolderName({ name: 'a'.repeat(120) })).toHaveLength(100)
    expect(normalizeFolderName({ name: `${'a'.repeat(99)} b` })).toBe(
      'a'.repeat(99)
    )
  })

  it('gives null for wrong parameters or an empty name', () => {
    expect(normalizeFolderName(null)).toBe(null)
    expect(normalizeFolderName({})).toBe(null)
    expect(normalizeFolderName({ name: 3 })).toBe(null)
    expect(normalizeFolderName({ name: '' })).toBe(null)
    expect(normalizeFolderName({ name: ' . / ' })).toBe(null)
  })
})
