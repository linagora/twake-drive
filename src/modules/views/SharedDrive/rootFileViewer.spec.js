import {
  findSharedDriveById,
  makeSharedDriveRootFileViewerFile
} from './rootFileViewer'

const makeSharedDrive = rule => ({ rules: [rule] })

const buildViewerFile = ({
  file = {},
  fileId = 'file-1',
  sharedDrive,
  driveId = 'drive-1'
} = {}) =>
  makeSharedDriveRootFileViewerFile({
    file: {
      _id: 'file-1',
      id: 'file-1',
      type: 'file',
      name: 'smoke-root',
      ...file
    },
    driveId,
    fileId,
    sharedDrive
  })

const viewerFileCases = [
  {
    label: 'uses sharing rule title',
    sharedDrive: makeSharedDrive({
      title: 'smoke-root.txt',
      mime: 'text/plain'
    }),
    expected: {
      _id: 'file-1',
      id: 'file-1',
      name: 'smoke-root.txt',
      mime: 'text/plain',
      class: 'text',
      path: '/Drives/smoke-root.txt',
      driveId: 'drive-1'
    }
  },
  {
    label: 'uses media MIME class',
    file: { name: 'Photo' },
    sharedDrive: makeSharedDrive({
      title: 'Photo.jpg',
      mime: 'image/jpeg'
    }),
    expected: {
      name: 'Photo.jpg',
      mime: 'image/jpeg',
      class: 'image'
    }
  },
  {
    label: 'prefers specific class',
    file: { mime: 'text/plain', class: 'file' },
    sharedDrive: makeSharedDrive({
      title: 'smoke-root.txt',
      mime: 'text/plain'
    }),
    expected: {
      name: 'smoke-root.txt',
      mime: 'text/plain',
      class: 'text'
    }
  },
  {
    label: 'derives file metadata from name when fetched file lacks MIME',
    file: {
      type: 'directory',
      name: 'smoke-root.txt',
      class: 'file',
      attributes: {
        type: 'directory',
        name: 'smoke-root.txt'
      }
    },
    expected: {
      type: 'file',
      attributes: {
        type: 'file',
        name: 'smoke-root.txt',
        class: 'text'
      },
      name: 'smoke-root.txt',
      class: 'text'
    }
  },
  {
    label: 'keeps fetched file name with extension',
    file: {
      name: 'CIR.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    sharedDrive: makeSharedDrive({ title: 'Stale.docx' }),
    expected: {
      name: 'CIR.docx',
      class: 'text'
    }
  },
  {
    label:
      'derives metadata from fetched file when shared drive data is missing',
    file: {
      _id: 'remote-file-1',
      id: 'remote-file-1',
      name: 'Photo.jpg',
      mime: 'image/jpeg'
    },
    fileId: 'route-file-1',
    expected: {
      _id: 'route-file-1',
      id: 'route-file-1',
      name: 'Photo.jpg',
      mime: 'image/jpeg',
      class: 'image'
    }
  },
  {
    label: 'keeps route file id as canonical viewer id',
    file: {
      _id: 'remote-file-1',
      id: 'remote-file-1',
      name: 'smoke-root'
    },
    fileId: 'route-file-1',
    sharedDrive: makeSharedDrive({
      title: 'smoke-root.txt',
      mime: 'text/plain'
    }),
    expected: {
      _id: 'route-file-1',
      id: 'route-file-1',
      name: 'smoke-root.txt'
    }
  },
  {
    label: 'sets fallback name and class when no metadata is available',
    file: {
      _id: 'remote-file-1',
      id: 'remote-file-1',
      name: undefined
    },
    fileId: 'route-file-1',
    expected: {
      _id: 'route-file-1',
      id: 'route-file-1',
      name: 'route-file-1',
      class: 'file'
    }
  }
]

describe('root file viewer helpers', () => {
  it('finds a shared drive by id or _id', () => {
    const sharedDrives = [{ _id: 'drive-1' }, { id: 'drive-2' }]

    expect(findSharedDriveById({ sharedDrives, driveId: 'drive-1' })).toBe(
      sharedDrives[0]
    )
    expect(findSharedDriveById({ sharedDrives, driveId: 'drive-2' })).toBe(
      sharedDrives[1]
    )
  })

  it('returns undefined while shared drives are still loading', () => {
    expect(
      findSharedDriveById({ sharedDrives: undefined, driveId: 'drive-1' })
    ).toBeUndefined()
  })

  it.each(viewerFileCases)('$label', options => {
    expect(buildViewerFile(options)).toMatchObject(options.expected)
  })
})
