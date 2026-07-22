import { useNavigate, useLocation } from 'react-router-dom'

import { makeFileShareLocation } from '@/modules/filelist/sharePath'

export const useFileShareNavigate = ({ file, disabled }) => {
  const navigate = useNavigate()
  const location = useLocation()

  return e => {
    // Avoid triggering row click from FileOpener.
    e.preventDefault()
    e.stopPropagation()

    if (!disabled) {
      navigate(makeFileShareLocation({ file, location }))
    }
  }
}
