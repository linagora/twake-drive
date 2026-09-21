import { useParams, useLocation } from 'react-router-dom'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'

const useCurrentFolderId = () => {
  const { folderId } = useParams()
  const { pathname = '' } = useLocation()

  if (folderId) {
    return folderId
  } else if (pathname === '/folder') {
    return ROOT_DIR_ID
  } else if (pathname === '/trash') {
    return TRASH_DIR_ID
  }
  return null
}

export default useCurrentFolderId
