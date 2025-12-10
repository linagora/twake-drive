import React from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import PreviousIcon from 'cozy-ui/transpiled/react/Icons/Previous'

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
      <Icon icon={PreviousIcon} />
    </IconButton>
  )
}

export default React.memo(BackButton)
