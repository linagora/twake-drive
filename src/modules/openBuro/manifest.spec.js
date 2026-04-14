import { driveManifest, findCapability, isActionDeclared } from './manifest'

describe('openBuro manifest', () => {
  it('exposes the Twake Drive entry', () => {
    expect(driveManifest).toBeDefined()
    expect(driveManifest.id).toBe('twake-drive')
    expect(driveManifest.name).toBe('Twake Drive')
    expect(Array.isArray(driveManifest.capabilities)).toBe(true)
  })

  it('declares the PICK capability at /capabilities/PICK', () => {
    const pick = findCapability('PICK')
    expect(pick).not.toBeNull()
    expect(pick.action).toBe('PICK')
    expect(pick.path).toBe('/capabilities/PICK')
    expect(pick.properties.mimeTypes).toContain('*/*')
  })

  it('findCapability returns null for an undeclared action', () => {
    expect(findCapability('NUKE')).toBeNull()
  })

  it('findCapability returns null for a missing action argument', () => {
    expect(findCapability(null)).toBeNull()
    expect(findCapability(undefined)).toBeNull()
    expect(findCapability('')).toBeNull()
  })

  it('isActionDeclared distinguishes declared from undeclared actions', () => {
    expect(isActionDeclared('PICK')).toBe(true)
    expect(isActionDeclared('SAVE')).toBe(false)
    expect(isActionDeclared('NUKE')).toBe(false)
  })
})
