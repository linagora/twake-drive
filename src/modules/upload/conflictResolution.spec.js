import {
  createFolderWithRenameOnFileCollision,
  generateUploadConflictName,
  MAX_UPLOAD_CONFLICT_RENAME_ATTEMPTS,
  replaceConflictingFile,
  resolveFileConflict,
  uploadWithRenamedFile
} from './conflictResolution'
import { uploadConflictStrategies } from './constants'

import logger from '@/lib/logger'
import { CozyFile } from '@/models'

jest.mock('cozy-doctypes')

const createFileSpy = jest.fn().mockName('createFile')
const createDirectorySpy = jest.fn().mockName('createDirectory')
const statByPathSpy = jest.fn().mockName('statByPath')
const updateFileSpy = jest.fn().mockName('updateFile')
const fakeClient = {
  collection: jest.fn(() => ({
    createFile: createFileSpy,
    createDirectory: createDirectorySpy,
    statByPath: statByPathSpy,
    updateFile: updateFileSpy
  }))
}

describe('conflict resolution service', () => {
  beforeEach(() => {
    createFileSpy.mockReset()
    createDirectorySpy.mockReset()
    statByPathSpy.mockReset()
    updateFileSpy.mockReset()
    fakeClient.collection.mockClear()
    CozyFile.getFullpath.mockReset()
    logger.warn = jest.fn()
    logger.error = jest.fn()
  })

  describe('generateUploadConflictName', () => {
    it('adds the suffix before a file extension', () => {
      expect(generateUploadConflictName('hello.docx')).toBe('hello_1.docx')
    })

    it('keeps only the last extension segment at the end', () => {
      expect(generateUploadConflictName('archive.tar.gz')).toBe(
        'archive.tar_1.gz'
      )
    })

    it('supports files without extensions', () => {
      expect(generateUploadConflictName('README')).toBe('README_1')
    })

    it('supports hidden files without creating an empty basename', () => {
      expect(generateUploadConflictName('.env')).toBe('.env_1')
    })

    it('increments an existing Cozy client conflict suffix', () => {
      expect(generateUploadConflictName('myfile_1.txt')).toBe('myfile_2.txt')
    })

    it('increments only trailing numeric Cozy client suffixes', () => {
      expect(generateUploadConflictName('report_2024.txt')).toBe(
        'report_2025.txt'
      )
      expect(generateUploadConflictName('report-2024-final.txt')).toBe(
        'report-2024-final_1.txt'
      )
    })

    it('supports directory names', () => {
      expect(generateUploadConflictName('Photos', 'directory')).toBe('Photos_1')
    })

    it('increments an existing directory suffix', () => {
      expect(generateUploadConflictName('Photos_1', 'directory')).toBe(
        'Photos_2'
      )
    })
  })

  describe('replaceConflictingFile', () => {
    it('updates the existing file and keeps versioning semantics', async () => {
      const file = new File(['content'], 'hello.docx')
      const onUploadProgress = jest.fn()
      updateFileSpy.mockResolvedValueOnce({
        data: { id: 'existing-file-id', name: 'hello.docx' }
      })

      const result = await replaceConflictingFile({
        client: fakeClient,
        file,
        fileId: 'existing-file-id',
        options: { onUploadProgress },
        driveId: 'drive-id'
      })

      expect(statByPathSpy).not.toHaveBeenCalled()
      expect(updateFileSpy).toHaveBeenCalledWith(file, {
        fileId: 'existing-file-id',
        onUploadProgress
      })
      expect(result).toEqual({
        data: { id: 'existing-file-id', name: 'hello.docx' },
        isUpdate: true,
        finalName: 'hello.docx'
      })
    })
  })

  describe('uploadWithRenamedFile', () => {
    it('uploads with the next generated name', async () => {
      const file = new File(['content'], 'hello.docx')
      const onNameResolved = jest.fn()
      createFileSpy.mockResolvedValueOnce({
        data: { id: 'new-file-id', name: 'hello_1.docx' }
      })

      const result = await uploadWithRenamedFile({
        client: fakeClient,
        file,
        dirID: 'parent-dir-id',
        options: { onUploadProgress: jest.fn() },
        driveId: 'drive-id',
        onNameResolved
      })

      expect(onNameResolved).toHaveBeenCalledWith('hello_1.docx')
      expect(createFileSpy).toHaveBeenCalledWith(file, {
        dirId: 'parent-dir-id',
        name: 'hello_1.docx',
        onUploadProgress: expect.any(Function)
      })
      expect(result).toEqual({
        data: { id: 'new-file-id', name: 'hello_1.docx' },
        isUpdate: false,
        finalName: 'hello_1.docx'
      })
    })

    it('keeps incrementing on repeated 409 responses', async () => {
      const file = new File(['content'], 'hello.docx')
      const onNameResolved = jest.fn()
      createFileSpy
        .mockRejectedValueOnce({ status: 409 })
        .mockResolvedValueOnce({
          data: { id: 'new-file-id', name: 'hello_2.docx' }
        })

      const result = await uploadWithRenamedFile({
        client: fakeClient,
        file,
        dirID: 'parent-dir-id',
        options: {},
        driveId: null,
        onNameResolved
      })

      expect(onNameResolved).toHaveBeenNthCalledWith(1, 'hello_1.docx')
      expect(onNameResolved).toHaveBeenNthCalledWith(2, 'hello_2.docx')
      expect(createFileSpy).toHaveBeenNthCalledWith(1, file, {
        dirId: 'parent-dir-id',
        name: 'hello_1.docx'
      })
      expect(createFileSpy).toHaveBeenNthCalledWith(2, file, {
        dirId: 'parent-dir-id',
        name: 'hello_2.docx'
      })
      expect(result.finalName).toBe('hello_2.docx')
    })

    it('fails instead of retrying forever when every generated file name conflicts', async () => {
      const file = new File(['content'], 'hello.docx')
      createFileSpy.mockRejectedValue({ status: 409 })

      await expect(
        uploadWithRenamedFile({
          client: fakeClient,
          file,
          dirID: 'parent-dir-id'
        })
      ).rejects.toMatchObject({
        code: 'UPLOAD_CONFLICT_RENAME_LIMIT_REACHED'
      })

      expect(createFileSpy).toHaveBeenCalledTimes(
        MAX_UPLOAD_CONFLICT_RENAME_ATTEMPTS
      )
      expect(createFileSpy).toHaveBeenLastCalledWith(file, {
        dirId: 'parent-dir-id',
        name: 'hello_1000.docx'
      })
      expect(logger.warn).toHaveBeenLastCalledWith(
        'Upload conflict rename for file still retrying after 1000 attempts'
      )
    })
  })

  describe('resolveFileConflict', () => {
    it('returns a pending conflict when a file already exists and no strategy is selected', async () => {
      const file = new File(['content'], 'hello.docx')
      const existingItem = {
        id: 'existing-file-id',
        type: 'file',
        name: 'hello.docx'
      }
      CozyFile.getFullpath.mockResolvedValueOnce('/parent/hello.docx')
      statByPathSpy.mockResolvedValueOnce({ data: existingItem })

      const result = await resolveFileConflict({
        client: fakeClient,
        file,
        dirID: 'parent-dir-id'
      })

      expect(result).toEqual({ isConflict: true })
      expect(createFileSpy).not.toHaveBeenCalled()
      expect(updateFileSpy).not.toHaveBeenCalled()
    })

    it('rejects when existing item stat fails', async () => {
      const file = new File(['content'], 'hello.docx')
      const statError = new Error('stat failed')
      statError.status = 500
      CozyFile.getFullpath.mockResolvedValueOnce('/parent/hello.docx')
      statByPathSpy.mockRejectedValueOnce(statError)

      await expect(
        resolveFileConflict({
          client: fakeClient,
          file,
          dirID: 'parent-dir-id'
        })
      ).rejects.toBe(statError)

      expect(createFileSpy).not.toHaveBeenCalled()
      expect(updateFileSpy).not.toHaveBeenCalled()
    })

    it('rejects when existing item path resolution fails', async () => {
      const file = new File(['content'], 'hello.docx')
      const pathError = new Error('path failed')
      CozyFile.getFullpath.mockRejectedValueOnce(pathError)

      await expect(
        resolveFileConflict({
          client: fakeClient,
          file,
          dirID: 'parent-dir-id'
        })
      ).rejects.toBe(pathError)

      expect(statByPathSpy).not.toHaveBeenCalled()
      expect(createFileSpy).not.toHaveBeenCalled()
      expect(updateFileSpy).not.toHaveBeenCalled()
    })

    it('uses updateFile when replace strategy is selected', async () => {
      const file = new File(['content'], 'hello.docx')
      const onUploadProgress = jest.fn()
      CozyFile.getFullpath.mockResolvedValueOnce('/parent/hello.docx')
      statByPathSpy.mockResolvedValueOnce({
        data: { id: 'existing-file-id', type: 'file', name: 'hello.docx' }
      })
      updateFileSpy.mockResolvedValueOnce({
        data: { id: 'existing-file-id', name: 'hello.docx' }
      })

      const result = await resolveFileConflict({
        client: fakeClient,
        file,
        dirID: 'parent-dir-id',
        uploadOptions: { onUploadProgress },
        driveId: null,
        getConflictStrategy: () => uploadConflictStrategies.REPLACE
      })

      expect(statByPathSpy).toHaveBeenCalledTimes(1)
      expect(updateFileSpy).toHaveBeenCalledWith(file, {
        fileId: 'existing-file-id',
        onUploadProgress
      })
      expect(result).toEqual({
        data: { id: 'existing-file-id', name: 'hello.docx' },
        isUpdate: true,
        finalName: 'hello.docx'
      })
    })

    it('uses a generated name when keep-both strategy is selected', async () => {
      const file = new File(['content'], 'hello.docx')
      CozyFile.getFullpath.mockResolvedValueOnce('/parent/hello.docx')
      statByPathSpy.mockResolvedValueOnce({
        data: { id: 'existing-file-id', type: 'file', name: 'hello.docx' }
      })
      createFileSpy.mockResolvedValueOnce({
        data: { id: 'new-file-id', name: 'hello_1.docx' }
      })

      const result = await resolveFileConflict({
        client: fakeClient,
        file,
        dirID: 'parent-dir-id',
        uploadOptions: {},
        driveId: null,
        getConflictStrategy: () => uploadConflictStrategies.KEEP_BOTH
      })

      expect(createFileSpy).toHaveBeenCalledWith(file, {
        dirId: 'parent-dir-id',
        name: 'hello_1.docx'
      })
      expect(result).toEqual({
        data: { id: 'new-file-id', name: 'hello_1.docx' },
        isUpdate: false,
        finalName: 'hello_1.docx'
      })
    })

    it('returns a cancelled conflict when cancel strategy is selected', async () => {
      const file = new File(['content'], 'hello.docx')
      const existingItem = {
        id: 'existing-file-id',
        type: 'file',
        name: 'hello.docx'
      }
      CozyFile.getFullpath.mockResolvedValueOnce('/parent/hello.docx')
      statByPathSpy.mockResolvedValueOnce({ data: existingItem })

      const result = await resolveFileConflict({
        client: fakeClient,
        file,
        dirID: 'parent-dir-id',
        uploadOptions: {},
        driveId: null,
        getConflictStrategy: () => uploadConflictStrategies.CANCEL
      })

      expect(result).toEqual({ isCancel: true })
    })

    it('renames automatically when a file name collides with a folder', async () => {
      const file = new File(['content'], 'hello.docx')
      CozyFile.getFullpath.mockResolvedValueOnce('/parent/hello.docx')
      statByPathSpy.mockResolvedValueOnce({
        data: {
          id: 'existing-folder-id',
          type: 'directory',
          name: 'hello.docx'
        }
      })
      createFileSpy.mockResolvedValueOnce({
        data: { id: 'new-file-id', name: 'hello_1.docx' }
      })

      const result = await resolveFileConflict({
        client: fakeClient,
        file,
        dirID: 'parent-dir-id'
      })

      expect(createFileSpy).toHaveBeenCalledWith(file, {
        dirId: 'parent-dir-id',
        name: 'hello_1.docx'
      })
      expect(result).toEqual({
        data: { id: 'new-file-id', name: 'hello_1.docx' },
        isUpdate: false,
        finalName: 'hello_1.docx'
      })
    })
  })

  describe('createFolderWithRenameOnFileCollision', () => {
    it('reuses an existing directory on folder-vs-folder conflict', async () => {
      createDirectorySpy.mockRejectedValueOnce({ status: 409 })
      CozyFile.getFullpath.mockResolvedValueOnce('/parent/Photos')
      statByPathSpy.mockResolvedValueOnce({
        data: { id: 'existing-folder-id', type: 'directory', name: 'Photos' }
      })

      const result = await createFolderWithRenameOnFileCollision({
        client: fakeClient,
        name: 'Photos',
        dirID: 'parent-dir-id'
      })

      expect(result).toEqual({
        data: { id: 'existing-folder-id', type: 'directory', name: 'Photos' },
        finalName: 'Photos',
        reusedExisting: true
      })
    })

    it('renames a folder when its original name collides with a file', async () => {
      createDirectorySpy
        .mockRejectedValueOnce({ status: 409 })
        .mockResolvedValueOnce({
          data: {
            id: 'created-folder-id',
            type: 'directory',
            name: 'Photos_1'
          }
        })
      CozyFile.getFullpath.mockResolvedValueOnce('/parent/Photos')
      statByPathSpy.mockResolvedValueOnce({
        data: { id: 'existing-file-id', type: 'file', name: 'Photos' }
      })

      const result = await createFolderWithRenameOnFileCollision({
        client: fakeClient,
        name: 'Photos',
        dirID: 'parent-dir-id'
      })

      expect(createDirectorySpy).toHaveBeenNthCalledWith(2, {
        name: 'Photos_1',
        dirId: 'parent-dir-id'
      })
      expect(result).toEqual({
        data: { id: 'created-folder-id', type: 'directory', name: 'Photos_1' },
        finalName: 'Photos_1',
        reusedExisting: false
      })
    })

    it('fails instead of retrying forever when every generated folder name conflicts with a file', async () => {
      createDirectorySpy.mockRejectedValue({ status: 409 })
      CozyFile.getFullpath.mockImplementation(
        (dirID, name) => `/parent/${name}`
      )
      statByPathSpy.mockResolvedValue({
        data: { id: 'existing-file-id', type: 'file', name: 'Photos' }
      })

      await expect(
        createFolderWithRenameOnFileCollision({
          client: fakeClient,
          name: 'Photos',
          dirID: 'parent-dir-id'
        })
      ).rejects.toMatchObject({
        code: 'UPLOAD_CONFLICT_RENAME_LIMIT_REACHED'
      })

      expect(createDirectorySpy).toHaveBeenCalledTimes(
        MAX_UPLOAD_CONFLICT_RENAME_ATTEMPTS + 1
      )
      expect(createDirectorySpy).toHaveBeenLastCalledWith({
        name: 'Photos_1000',
        dirId: 'parent-dir-id'
      })
      expect(logger.warn).toHaveBeenLastCalledWith(
        'Upload conflict rename for directory still retrying after 1000 attempts'
      )
    })
  })
})
