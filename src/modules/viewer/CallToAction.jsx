import localforage from 'localforage'
import React, { Component } from 'react'

import { withClient } from 'cozy-client'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'

import styles from './styles.styl'

import {
  getDesktopAppDownloadLink,
  isClientAlreadyInstalled,
  NOVIEWER_DESKTOP_CTA
} from '@/components/pushClient'
import Config from '@/config/config.json'

class CallToAction extends Component {
  state = {
    mustShow: false
  }

  async componentDidMount() {
    if (Config.promoteDesktop.isActivated !== true) return
    const seen = (await localforage.getItem(NOVIEWER_DESKTOP_CTA)) || false
    if (!seen) {
      try {
        const mustSee = !(await isClientAlreadyInstalled(this.props.client))
        if (mustSee) {
          this.setState({ mustShow: true })
        }
      } catch (_e) {
        this.setState({ mustShow: false })
      }
    }
  }

  markAsSeen = () => {
    localforage.setItem(NOVIEWER_DESKTOP_CTA, true)
    this.setState({ mustShow: false })
  }

  render() {
    if (!this.state.mustShow || Config.promoteDesktop.isActivated !== true)
      return null

    const { t } = this.props

    const link = getDesktopAppDownloadLink({ t })

    return (
      <div className={styles['pho-viewer-noviewer-cta']}>
        <Icon
          className={styles['pho-viewer-noviewer-cta-cross']}
          color="var(--white)"
          icon={CrossIcon}
          onClick={this.markAsSeen}
        />
        <h3>{t('Viewer.noviewer.cta.saveTime')}</h3>
        <ul>
          <li>
            <a target="_blank" href={link} rel="noreferrer">
              {t('Viewer.noviewer.cta.installDesktop')}
            </a>
          </li>
          <li>{t('Viewer.noviewer.cta.accessFiles')}</li>
        </ul>
      </div>
    )
  }
}
export default withClient(CallToAction)
