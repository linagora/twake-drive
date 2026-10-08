import { useEffect } from 'react'

import { reportSpaceFiles } from '@/modules/views/Space/SpaceLayout'

const useReportSpaceFiles = (driveId, folder, isRoot) => {
  const count = folder?.relationships?.contents?.meta?.count

  useEffect(() => {
    if (isRoot && count !== undefined) reportSpaceFiles(driveId, count)
  }, [isRoot, driveId, count])
}

export { useReportSpaceFiles }
