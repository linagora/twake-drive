export const generateFile = ({
  i,
  prefix = 'foobar',
  type = 'file',
  ext,
  path = '/',
  dir_id = 'io.cozy.files.root-dir',
  updated_at = ''
} = {}) => {
  let extension = ext
  if (extension === undefined) {
    if (type === 'file') {
      extension = '.pdf'
    } else if (type === 'directory') {
      extension = ''
    }
  }
  let optional = {}
  if (type === 'file') {
    optional = {
      ...optional,
      size: 10
    }
  }
  if (updated_at !== '') {
    optional = {
      ...optional,
      updated_at
    }
  }
  return {
    dir_id,
    displayedPath: path,
    id: `${type}-${prefix}${i}`,
    _id: `${type}-${prefix}${i}`,
    name: `${prefix}${i}${extension}`,
    path: `${path === '/' ? '' : path}/${prefix}${i}${extension}`,
    type,
    _type: 'io.cozy.files',
    ...optional
  }
}
