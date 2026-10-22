import cx from 'classnames'
import Lottie from 'lottie-react'
import React from 'react'

import buttonAnimation from './assets/scribeButtonAnimation.json'
import styles from './styles.styl'

export const ScribeButtonMark = ({ lottieRef }) => (
  <Lottie
    className={cx('u-pos-absolute', styles['scribe-floating-button-mark'])}
    lottieRef={lottieRef}
    animationData={buttonAnimation}
    autoplay={false}
    aria-hidden="true"
  />
)
