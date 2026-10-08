import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { isSpacePath } from '@/modules/routeUtils'
import { reportSpaceFiles } from '@/modules/views/Space/SpaceLayout'

const useReportSpaceFiles = ({ driveId, folder, isRoot }) => {
  const { pathname } = useLocation()
  const count = folder?.relationships?.contents?.meta?.count

  useEffect(() => {
    if (isRoot && isSpacePath(pathname) && count !== undefined) {
      reportSpaceFiles(driveId, count)
    }
  }, [isRoot, pathname, driveId, count])
}

export { useReportSpaceFiles }
