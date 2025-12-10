import React from 'react'
import { useI18n } from 'twake-i18n'

import Empty from 'cozy-ui/transpiled/react/Empty'

import DesertIllustration from '@/assets/icons/illustrations-desert.svg'

const NotFound = () => {
  const { t } = useI18n()

  return (
    <Empty
      icon={DesertIllustration}
      title={t('NotFound.title')}
      text={t('NotFound.text')}
    />
  )
}

export { NotFound }
