import type { IOCozyFile } from 'cozy-client/types/types'

import {
  filterActionsByPolicy,
  hasAnyInfectedFile,
  buildPolicyContext,
  ACTION_POLICIES
} from './policies'
import type { DriveAction, ActionPolicyContext } from './types'

// Mock cozy-client isDirectory
jest.mock('cozy-client/dist/models/file', () => ({
  isDirectory: jest.fn((file: { type?: string }) => file.type === 'directory')
}))

describe('policies', () => {
  // Helper to create a wrapped action (as returned by makeActions)
  const createWrappedAction = (
    name: string,
    options: Partial<DriveAction> = {}
  ): Record<string, DriveAction> => ({
    [name]: {
      name,
      ...options
    }
  })

  // Helper to create a mock file
  const createMockFile = (
    id: string,
    options: {
      infected?: boolean
      trashed?: boolean
      type?: 'file' | 'directory'
      pending?: boolean
    } = {}
  ): Partial<IOCozyFile> => ({
    _id: id,
    type: options.type ?? 'file',
    trashed: options.trashed ?? false,
    ...(options.infected && { antivirus_scan: { status: 'infected' } }),
    ...(options.pending && { antivirus_scan: { status: 'pending' } })
  })

  describe('buildPolicyContext', () => {
    it('should detect infected files', () => {
      const files = [
        createMockFile('file1', { infected: true }),
        createMockFile('file2')
      ] as IOCozyFile[]

      const ctx = buildPolicyContext(files)

      expect(ctx.hasInfectedFile).toBe(true)
    })

    it('should detect multiple files', () => {
      const files = [
        createMockFile('file1'),
        createMockFile('file2')
      ] as IOCozyFile[]

      const ctx = buildPolicyContext(files)

      expect(ctx.hasMultipleFiles).toBe(true)
    })

    it('should detect folders', () => {
      const files = [
        createMockFile('folder1', { type: 'directory' })
      ] as IOCozyFile[]

      const ctx = buildPolicyContext(files)

      expect(ctx.hasFolder).toBe(true)
    })

    it('should detect all trashed files', () => {
      const files = [
        createMockFile('file1', { trashed: true }),
        createMockFile('file2', { trashed: true })
      ] as IOCozyFile[]

      const ctx = buildPolicyContext(files)

      expect(ctx.allInTrash).toBe(true)
    })

    it('should not mark allInTrash if some files are not trashed', () => {
      const files = [
        createMockFile('file1', { trashed: true }),
        createMockFile('file2', { trashed: false })
      ] as IOCozyFile[]

      const ctx = buildPolicyContext(files)

      expect(ctx.allInTrash).toBe(false)
    })
  })

  describe('ACTION_POLICIES', () => {
    it('should have all expected policies registered', () => {
      const policyNames = ACTION_POLICIES.map(p => p.name)

      expect(policyNames).toContain('infection')
      expect(policyNames).toContain('notScanned')
      expect(policyNames).toContain('multipleFiles')
      expect(policyNames).toContain('folders')
      expect(policyNames).toContain('trashed')
    })

    describe('infection policy', () => {
      const infectionPolicy = ACTION_POLICIES.find(p => p.name === 'infection')

      if (!infectionPolicy) {
        throw new Error('infection policy not found')
      }

      it('should allow action when no infected files', () => {
        const action = { allowInfectedFiles: false }
        const ctx = { hasInfectedFile: false } as ActionPolicyContext

        expect(infectionPolicy.allows(action, ctx)).toBe(true)
      })

      it('should block action when infected files and not allowed', () => {
        const action = { allowInfectedFiles: false }
        const ctx = { hasInfectedFile: true } as ActionPolicyContext

        expect(infectionPolicy.allows(action, ctx)).toBe(false)
      })

      it('should allow action when infected files and explicitly allowed', () => {
        const action = { allowInfectedFiles: true }
        const ctx = { hasInfectedFile: true } as ActionPolicyContext

        expect(infectionPolicy.allows(action, ctx)).toBe(true)
      })
    })

    describe('notScanned policy', () => {
      const notScannedPolicy = ACTION_POLICIES.find(
        p => p.name === 'notScanned'
      )

      if (!notScannedPolicy) {
        throw new Error('notScanned policy not found')
      }

      it('should allow action when no pending files', () => {
        const action = { allowNotScannedFiles: false }
        const ctx = { hasNotScannedFile: false } as ActionPolicyContext

        expect(notScannedPolicy.allows(action, ctx)).toBe(true)
      })

      it('should block action when pending files and not allowed', () => {
        const action = { allowNotScannedFiles: false }
        const ctx = { hasNotScannedFile: true } as ActionPolicyContext

        expect(notScannedPolicy.allows(action, ctx)).toBe(false)
      })

      it('should allow action when pending files and explicitly allowed', () => {
        const action = { allowNotScannedFiles: true }
        const ctx = { hasNotScannedFile: true } as ActionPolicyContext

        expect(notScannedPolicy.allows(action, ctx)).toBe(true)
      })
    })

    describe('multipleFiles policy', () => {
      const multipleFilesPolicy = ACTION_POLICIES.find(
        p => p.name === 'multipleFiles'
      )

      if (!multipleFilesPolicy) {
        throw new Error('multipleFiles policy not found in ACTION_POLICIES')
      }

      it('should allow action for single file by default', () => {
        const action = {}
        const ctx = { hasMultipleFiles: false } as ActionPolicyContext

        expect(multipleFilesPolicy.allows(action, ctx)).toBe(true)
      })

      it('should allow action for multiple files by default', () => {
        const action = {}
        const ctx = { hasMultipleFiles: true } as ActionPolicyContext

        expect(multipleFilesPolicy.allows(action, ctx)).toBe(true)
      })

      it('should block action for multiple files when explicitly disallowed', () => {
        const action = { allowMultiple: false }
        const ctx = { hasMultipleFiles: true } as ActionPolicyContext

        expect(multipleFilesPolicy.allows(action, ctx)).toBe(false)
      })
    })

    describe('trashed policy', () => {
      const trashedPolicy = ACTION_POLICIES.find(p => p.name === 'trashed')

      if (!trashedPolicy) {
        throw new Error('trashedPolicy not found in ACTION_POLICIES')
      }

      it('should allow action when files not in trash', () => {
        const action = {}
        const ctx = { allInTrash: false } as ActionPolicyContext

        expect(trashedPolicy.allows(action, ctx)).toBe(true)
      })

      it('should block action when files in trash and not allowed', () => {
        const action = {}
        const ctx = { allInTrash: true } as ActionPolicyContext

        expect(trashedPolicy.allows(action, ctx)).toBe(false)
      })

      it('should allow action when files in trash and explicitly allowed', () => {
        const action = { allowTrashed: true }
        const ctx = { allInTrash: true } as ActionPolicyContext

        expect(trashedPolicy.allows(action, ctx)).toBe(true)
      })
    })
  })

  describe('filterActionsByPolicy', () => {
    it('should return all actions when no policy restrictions apply', () => {
      const actions = [
        createWrappedAction('download'),
        createWrappedAction('share'),
        createWrappedAction('trash')
      ]
      const files = [createMockFile('file1')] as IOCozyFile[]

      const result = filterActionsByPolicy(actions, files)

      expect(result).toHaveLength(3)
    })

    it('should filter out actions blocked by infection policy', () => {
      const actions = [
        createWrappedAction('download', { allowInfectedFiles: false }),
        createWrappedAction('share', { allowInfectedFiles: false }),
        createWrappedAction('trash', { allowInfectedFiles: true })
      ]
      const files = [
        createMockFile('file1', { infected: true })
      ] as IOCozyFile[]

      const result = filterActionsByPolicy(actions, files)

      expect(result).toHaveLength(1)
      expect(Object.keys(result[0])[0]).toBe('trash')
    })

    it('should filter out actions blocked by multiple files policy', () => {
      const actions = [
        createWrappedAction('download'),
        createWrappedAction('rename', { allowMultiple: false }),
        createWrappedAction('trash')
      ]
      const files = [
        createMockFile('file1'),
        createMockFile('file2')
      ] as IOCozyFile[]

      const result = filterActionsByPolicy(actions, files)

      expect(result).toHaveLength(2)
      expect(result.map(a => Object.keys(a)[0])).toEqual(['download', 'trash'])
    })

    it('should filter out actions blocked by trashed policy', () => {
      const actions = [
        createWrappedAction('download'),
        createWrappedAction('restore', { allowTrashed: true }),
        createWrappedAction('share')
      ]
      const files = [createMockFile('file1', { trashed: true })] as IOCozyFile[]

      const result = filterActionsByPolicy(actions, files)

      expect(result).toHaveLength(1)
      expect(Object.keys(result[0])[0]).toBe('restore')
    })

    it('should handle empty actions array', () => {
      const actions: Record<string, DriveAction>[] = []
      const files = [
        createMockFile('file1', { infected: true })
      ] as IOCozyFile[]

      const result = filterActionsByPolicy(actions, files)

      expect(result).toHaveLength(0)
    })

    it('should handle empty files array', () => {
      const actions = [
        createWrappedAction('download'),
        createWrappedAction('trash')
      ]
      const files: IOCozyFile[] = []

      const result = filterActionsByPolicy(actions, files)

      expect(result).toHaveLength(2)
    })

    it('should allow empty action wrappers (fail-open behavior)', () => {
      // Test that empty wrappers are allowed through the filter
      // This verifies the contract that getActionFromWrapper can return null
      // and isActionAllowedByPolicies is not called for such cases
      const actions = [
        createWrappedAction('download'),
        {} as Record<string, DriveAction>, // Empty wrapper
        createWrappedAction('trash')
      ]
      const files = [createMockFile('file1')] as IOCozyFile[]

      const result = filterActionsByPolicy(actions, files)

      // Empty wrapper should be included in results (fail-open)
      expect(result).toHaveLength(3)
      expect(result[1]).toEqual({})
    })

    it('should apply multiple policies together', () => {
      const actions = [
        createWrappedAction('download', { allowInfectedFiles: false }),
        createWrappedAction('rename', {
          allowInfectedFiles: true,
          allowMultiple: false
        }),
        createWrappedAction('trash', { allowInfectedFiles: true })
      ]
      // Multiple infected files
      const files = [
        createMockFile('file1', { infected: true }),
        createMockFile('file2', { infected: true })
      ] as IOCozyFile[]

      const result = filterActionsByPolicy(actions, files)

      // download blocked by infection, rename blocked by multiple files
      expect(result).toHaveLength(1)
      expect(Object.keys(result[0])[0]).toBe('trash')
    })
  })

  describe('hasAnyInfectedFile', () => {
    it('should return false when no files are infected', () => {
      const files = [
        createMockFile('file1'),
        createMockFile('file2')
      ] as IOCozyFile[]

      const result = hasAnyInfectedFile(files)

      expect(result).toBe(false)
    })

    it('should return true when at least one file is infected', () => {
      const files = [
        createMockFile('file1', { infected: true }),
        createMockFile('file2')
      ] as IOCozyFile[]

      const result = hasAnyInfectedFile(files)

      expect(result).toBe(true)
    })

    it('should return false for empty array', () => {
      const files: IOCozyFile[] = []

      const result = hasAnyInfectedFile(files)

      expect(result).toBe(false)
    })
  })
})
