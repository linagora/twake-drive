import {
  makeCapabilities,
  makeFileName,
  normalizeFolderName,
  splitTitle
} from '@/modules/views/Drive/Assistant/capabilities'

const t = key => `t(${key})`

describe('makeCapabilities', () => {
  it('lets the assistant create a folder and a document, with translated labels', () => {
    const capabilities = makeCapabilities({ t })

    expect(capabilities.map(capability => capability.name)).toEqual([
      'create_folder',
      'create_document'
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
    expect(capabilities[1]).toMatchObject({
      label: 't(Assistant.createDocument)',
      content: { max_tokens: 2048 },
      instructions: expect.any(String)
    })
    expect(capabilities[1]).not.toHaveProperty('parameters')
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

describe('splitTitle', () => {
  it('splits the title line from the content', () => {
    expect(splitTitle('# **Atlas** report\n\n## Status\nOn time.')).toEqual({
      title: 'Atlas report',
      body: '## Status\nOn time.'
    })
  })

  it('keeps a content without title line whole', () => {
    expect(splitTitle('## Status\nOn time.')).toEqual({
      title: null,
      body: '## Status\nOn time.'
    })
  })
})

describe('makeFileName', () => {
  it('names the file after the title, with the extension', () => {
    expect(makeFileName('Atlas report', 'docx')).toBe('Atlas report.docx')
  })

  it('leaves out the characters a file name cannot have', () => {
    expect(makeFileName(' Atlas: report / 2026? ', 'docx')).toBe(
      'Atlas report 2026.docx'
    )
    expect(makeFileName(`${'a'.repeat(120)}`, 'docx')).toBe(
      `${'a'.repeat(100)}.docx`
    )
  })

  it('names a document without title', () => {
    expect(makeFileName('/', 'docx')).toBe('Document.docx')
  })
})
