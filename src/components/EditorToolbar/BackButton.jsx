import { Icon, Previous } from '@linagora/twake-icons'
import React from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { useI18n } from 'twake-i18n'

const BackButton = ({ onClick }) => {
  // TODO: remove u-ml-half-s when https://github.com/cozy/cozy-ui/issues/1808 is fixed
  const { t } = useI18n()

  return (
    <IconButton
      data-testid="onlyoffice-backButton"
      className="u-ml-half-s"
      onClick={onClick}
      size="medium"
      aria-label={t('button.back')}
    >
      <Icon icon={Previous} />
    </IconButton>
  )
}

export default React.memo(BackButton)
