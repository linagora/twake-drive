import { joinPath } from '@/lib/path'

export const navigateToModal = ({ navigate, pathname, files, path }) => {
  const file = Array.isArray(files) ? files[0] : files

  return navigate(
    pathname ? joinPath(pathname, `file/${file.id}/${path}`) : `v/${path}`
  )
}

export const navigateToModalWithMultipleFile = ({
  navigate,
  pathname,
  files,
  path,
  search
}) => {
  return navigate(
    {
      pathname: pathname ? joinPath(pathname, path) : `v/${path}`,
      search: search ? `?${search}` : ''
    },
    {
      state: { fileIds: files.map(file => file.id) }
    }
  )
}

/**
 * Returns the context menu visible actions
 *
 * @param {Object[]} actions - the list of actions
 * @returns {Object[]} - the list of actions to be displayed
 */
export const getContextMenuActions = (actions = []) =>
  actions.filter(
    action => Object.values(action)[0]?.displayInContextMenu !== false
  )
