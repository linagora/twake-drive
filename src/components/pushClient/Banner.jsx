// eslint-disable-next-line no-redeclare,no-unused-vars
/* global localStorage */

import localforage from 'localforage'
import flow from 'lodash/flow'
import React, { Component } from 'react'
import { translate } from 'twake-i18n'

import { withClient } from 'cozy-client'
import Banner from 'cozy-ui/transpiled/react/Banner'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import DesktopDownloadIcon from 'cozy-ui/transpiled/react/Icons/DesktopDownload'
import DownloadIcon from 'cozy-ui/transpiled/react/Icons/Download'
import PhoneDownloadIcon from 'cozy-ui/transpiled/react/Icons/PhoneDownload'

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
    if (Config.promoteDesktop.isActivated !== true || !this.state.mustShow)
      return null

    const { t } = this.props

    const isMobile = isIOS() || isAndroid()
    const text = isMobile ? 'Nav.btn-client-mobile' : 'Nav.banner-txt-client'
    const link = isMobile
      ? getMobileAppDownloadLink({ t })
      : getDesktopAppDownloadLink({ t })

    return (
      <div className="u-pos-relative">
        <Banner
          inline
          disableIconStyles
          icon={
            <Icon
              className="u-mt-1 u-ml-1"
              icon={isMobile ? PhoneDownloadIcon : DesktopDownloadIcon}
              color="var(--primaryTextColor)"
              size={isMobile ? 24 : 20}
            />
          }
          text={t(text, {
            name: 'Twake Drive'
          })}
          bgcolor="var(--defaultBackgroundColor)"
          buttonOne={
            <Button
              component="a"
              variant="text"
              label={t('Nav.banner-btn-client')}
              size="small"
              onClick={() => this.markAsSeen('banner')}
              startIcon={<Icon icon={DownloadIcon} />}
              target="_blank"
              href={link}
            />
          }
          buttonTwo={
            <Button
              variant="text"
              label={t('SelectionBar.close')}
              size="small"
              onClick={() => this.markAsSeen('close')}
            />
          }
          noDivider
        />
      </div>
    )
  }
}

export default flow(translate(), withClient)(BannerClient)
