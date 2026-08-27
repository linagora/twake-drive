import { useNavigate, useLocation } from 'react-router-dom'

import { makeFileSharePath } from '@/modules/filelist/sharePath'

export const useFileShareNavigate = ({ file, disabled }) => {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  return e => {
    // Avoid triggering row click from FileOpener.
    e.preventDefault()
    e.stopPropagation()

    if (!disabled) {
      navigate({ pathname: makeFileSharePath({ file, pathname }), search })
    }
  }
}
