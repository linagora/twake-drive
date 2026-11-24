import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'

import CircularProgress from 'cozy-ui/transpiled/react/CircularProgress'
import withBreakpoints from 'cozy-ui/transpiled/react/helpers/withBreakpoints'

import { ROUTER_FUTURE_FLAGS } from '@/constants/config'
import FileOpenerExternal from '@/modules/viewer/FileOpenerExternal'
import OnlyOfficeView from '@/modules/views/OnlyOffice'
import { isOfficeEnabled } from '@/modules/views/OnlyOffice/helpers'

class Embeder extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true
    }
  }

  componentDidMount() {
    this.fetchFileUrl()
  }

  async fetchFileUrl() {
    const { service } = this.props

    try {
      const { id } = service.getData()
      this.setState({ fileId: id, loading: false })
    } catch (error) {
      this.setState({ error, loading: false })
    }
  }

  render() {
    const {
      service,
      breakpoints: { isDesktop }
    } = this.props
    return (
      <div>
        {this.state.loading && (
          <div className="u-pos-absolute u-top-0 u-bottom-0 u-left-0 u-right-0 u-flex u-flex-items-center u-flex-justify-center">
            <CircularProgress
              className="u-primaryContrastTextColor"
              color="inherit"
              size={80}
            />
          </div>
        )}
        {this.state.error && (
          <pre className="u-error">{this.state.error.toString()}</pre>
        )}
        {this.state.fileId && (
          <HashRouter future={ROUTER_FUTURE_FLAGS}>
            <Routes>
              <Route
                path="/"
                element={
                  <FileOpenerExternal
                    service={service}
                    fileId={this.state.fileId}
                  />
                }
              />
              {isOfficeEnabled(isDesktop) && (
                <Route path="onlyoffice/:fileId" element={<OnlyOfficeView />} />
              )}
            </Routes>
          </HashRouter>
        )}
      </div>
    )
  }
}

export default withBreakpoints()(Embeder)
