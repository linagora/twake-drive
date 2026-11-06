import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { isInTrashDir } from '@/modules/trash/helpers'

export const useTrashRedirect = displayedFolder => {
  const navigate = useNavigate()

  useEffect(() => {
    if (displayedFolder && isInTrashDir(displayedFolder.path)) {
      navigate('/trash/' + displayedFolder.id)
    }
  }, [navigate, displayedFolder])
}
