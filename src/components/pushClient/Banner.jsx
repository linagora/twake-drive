// eslint-disable-next-line no-redeclare,no-unused-vars
/* global localStorage */

import {
  Icon,
  DesktopDownload,
  Download,
  PhoneDownload
} from '@linagora/twake-icons'
import localforage from 'localforage'
import flow from 'lodash/flow'
import React, { Component } from 'react'

import { withClient } from 'cozy-client'
import flag from 'cozy-flags'
import Alert from 'cozy-ui/transpiled/react/Alert'
import Button from 'cozy-ui/transpiled/react/Buttons'
import { translate } from 'twake-i18n'

import {
  getMobileAppDownloadLink,
  getDesktopAppDownloadLink,
  isClientAlreadyInstalled,
  isAndroid,
  isIOS,
  DESKTOP_BANNER
} from '@/components/pushClient'
import Config from '@/config/config.json'

class BannerClient extends Component {
  state = {
    mustShow: false
  }
  constructor(props) {
    super(props)
    this.willUnmount = false
  }

  async componentDidMount() {
    this.willUnmount = false
    const seen = (await localforage.getItem(DESKTOP_BANNER)) || false
    if (!seen) {
      const mustSee = !(await isClientAlreadyInstalled(this.props.client))
      if (mustSee && !this.willUnmount) {
        this.setState({ mustShow: true })
      }
    }
  }
  componentWillUnmount() {
    this.willUnmount = true
  }

  markAsSeen() {
    localforage.setItem(DESKTOP_BANNER, true)
    this.setState({ mustShow: false })
  }

  render() {
    if (Config.promoteApp.isActivated !== true || !this.state.mustShow)
      return null

    const { t } = this.props

    const isMobile = isIOS() || isAndroid()
    if (isMobile && flag('drive.pushBanner-hide-mobile.enabled')) return null
    if (!isMobile && flag('drive.pushBanner-hide-desktop.enabled')) return null

    const text = isMobile ? 'Nav.btn-client-mobile' : 'Nav.banner-txt-client'
    const link = isMobile
      ? getMobileAppDownloadLink({ t })
      : getDesktopAppDownloadLink({ t })

    return (
      <div className="u-pos-relative">
        <Alert
          square
          icon={
            <Icon
              className="u-mt-1 u-ml-1"
              icon={isMobile ? PhoneDownload : DesktopDownload}
              color="var(--primaryTextColor)"
              size={isMobile ? 24 : 20}
            />
          }
          color="var(--defaultBackgroundColor)"
          action={
            <>
              <Button
                component="a"
                variant="text"
                label={t('Nav.banner-btn-client')}
                size="small"
                onClick={() => this.markAsSeen()}
                startIcon={<Icon icon={Download} />}
                target="_blank"
                rel="noopener noreferrer"
                href={link}
              />
              <Button
                variant="text"
                label={t('SelectionBar.close')}
                size="small"
                onClick={() => this.markAsSeen()}
              />
            </>
          }
        >
          {t(text, {
            name: 'Twake Drive'
          })}
        </Alert>
      </div>
    )
  }
}

export default flow(translate(), withClient)(BannerClient)
