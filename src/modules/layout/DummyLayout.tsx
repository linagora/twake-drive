import React from 'react'

import { Layout } from 'cozy-ui/transpiled/react/Layout'

const DummyLayout: React.FC = ({ children }) => {
  return <Layout monoColumn={true}>{children}</Layout>
}

export { DummyLayout }
