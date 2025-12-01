import React, { FC, useMemo } from 'react'
import { Outlet } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import { Content } from 'cozy-ui/transpiled/react/Layout'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { ROOT_DIR_ID } from '@/constants/config'
import { useFolderSort } from '@/hooks'
import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import { makeExtraColumnsNamesFromMedia } from '@/modules/certifications'
import {
  useExtraColumns,
  ExtraColumn
} from '@/modules/certifications/useExtraColumns'
import { FolderBody } from '@/modules/folder/components/FolderBody'
import FolderView from '@/modules/views/Folder/FolderView'
import FolderViewBreadcrumb from '@/modules/views/Folder/FolderViewBreadcrumb'
import FolderViewHeader from '@/modules/views/Folder/FolderViewHeader'
import {
  buildDriveQuery,
  buildFileWithSpecificMetadataAttributeQuery
} from '@/queries'

const desktopExtraColumnsNames = ['carbonCopy', 'electronicSafe']
const mobileExtraColumnsNames: string[] = []

const SharedDrivesFolderView: FC = () => {
  const { isMobile } = useBreakpoints()
  const { t } = useI18n()
  const { isNotFound } = useDisplayedFolder()

  const extraColumnsNames = makeExtraColumnsNamesFromMedia({
    isMobile,
    desktopExtraColumnsNames,
    mobileExtraColumnsNames
  })

  const extraColumns = useExtraColumns({
    columnsNames: extraColumnsNames,
    queryBuilder: buildFileWithSpecificMetadataAttributeQuery,
    currentFolderId: 'io.cozy.files.shared-drives-dir'
  }) as ExtraColumn[]

  const [sortOrder] = useFolderSort('io.cozy.files.shared-drives-dir')

  const folderQuery = buildDriveQuery({
    currentFolderId: 'io.cozy.files.shared-drives-dir',
    type: 'directory',
    sortAttribute: sortOrder.attribute,
    sortOrder: sortOrder.order
  })
  const fileQuery = buildDriveQuery({
    currentFolderId: 'io.cozy.files.shared-drives-dir',
    type: 'file',
    sortAttribute: sortOrder.attribute,
    sortOrder: sortOrder.order
  })

  const foldersResult = useQuery(folderQuery.definition, folderQuery.options)
  const filesResult = useQuery(fileQuery.definition, fileQuery.options)

  const queryResults = [foldersResult, filesResult]

  const rootBreadcrumbPath = useMemo(
    () => ({
      id: ROOT_DIR_ID,
      name: t('breadcrumb.title_drive')
    }),
    [t]
  )

  return (
    <FolderView isNotFound={isNotFound}>
      <Content className={isMobile ? '' : 'u-pt-1'}>
        <FolderViewHeader>
          <FolderViewBreadcrumb
            rootBreadcrumbPath={rootBreadcrumbPath}
            currentFolderId="io.cozy.files.shared-drives-dir"
          />
        </FolderViewHeader>
        <FolderBody
          folderId="io.cozy.files.shared-drives-dir"
          queryResults={queryResults}
          extraColumns={extraColumns}
        />
        <Outlet />
      </Content>
    </FolderView>
  )
}

export { SharedDrivesFolderView }
