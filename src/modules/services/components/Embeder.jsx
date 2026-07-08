import { Sprite } from '@linagora/twake-icons'
import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'

import Spinner from 'cozy-ui/transpiled/react/Spinner'
import withBreakpoints from 'cozy-ui/transpiled/react/helpers/withBreakpoints'

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
          <Spinner size="xxlarge" middle noMargin color="white" />
        )}
        {this.state.error && (
          <pre className="u-error">{this.state.error.toString()}</pre>
        )}
        {this.state.fileId && (
          <HashRouter>
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
        <Sprite />
      </div>
    )
  }
}

export default withBreakpoints()(Embeder)
