import { Icon, CrossCircleOutline, Magnifier } from '@linagora/twake-icons'
import React from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import InputGroup from 'cozy-ui/transpiled/react/InputGroup'

import styles from '@/modules/search/components/styles.styl'

const BarSearchInputGroup = ({
  children,
  isMobile,
  onClean,
  isInputNotEmpty
}) => {
  return (
    <InputGroup
      fullwidth={true}
      className={styles['bar-search-input-group']}
      prepend={
        !isMobile ? (
          <Icon
            icon={Magnifier}
            className={styles['bar-search-input-group-append']}
            aria-hidden="true"
          />
        ) : null
      }
      append={
        isInputNotEmpty ? (
          <IconButton size="medium" onClick={onClean}>
            <Icon icon={CrossCircleOutline} />
          </IconButton>
        ) : null
      }
    >
      {children}
    </InputGroup>
  )
}

export default BarSearchInputGroup
