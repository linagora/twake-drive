import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import Empty from 'cozy-ui/transpiled/react/Empty'
import { Content } from 'cozy-ui/transpiled/react/Layout'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import FolderView from '../Folder/FolderView'
import FolderViewHeader from '../Folder/FolderViewHeader'

import DesertIllustration from '@/assets/icons/illustrations-desert.svg'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'

const RecentNoAccessView = () => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const { type } = useParams()
  const navigate = useNavigate()
  const isDirectory = type === 'directory'
  const title = t(
    isDirectory ? 'RecentNoAccess.folder_title' : 'RecentNoAccess.file_title'
  )

  const goToRecents = () => navigate('/recent', { replace: true })

  return (
    <FolderView>
      <Content className={isMobile ? '' : 'u-pt-1'}>
        <FolderViewHeader>
          <Breadcrumb
            path={[{ name: t('breadcrumb.title_recent') }]}
            onBreadcrumbClick={goToRecents}
          />
        </FolderViewHeader>
        <Empty icon={DesertIllustration} title={title} />
      </Content>
    </FolderView>
  )
}

export default RecentNoAccessView
