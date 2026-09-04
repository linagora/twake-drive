import { render, screen } from '@testing-library/react'
import React from 'react'

import flag from 'cozy-flags'

import Main from './Main'

jest.mock('cozy-ui/transpiled/react/Layout', () => ({
  Main: ({ children }) => <div>{children}</div>
}))
jest.mock('cozy-client', () => ({
  RealTimeQueries: () => <div data-testid="realtime-queries" />
}))
jest.mock('cozy-flags', () => jest.fn())
jest.mock('@/components/PushBanner', () => () => (
  <div data-testid="push-banner" />
))
jest.mock('@/components/Migration/MigrationProgressBanner', () => ({
  MigrationProgressBanner: () => <div data-testid="migration-banner" />
}))

describe('Main', () => {
  beforeEach(() => {
    flag.mockReturnValue(true)
  })

  it('does not mount PushBanner on the public route', () => {
    // PushBanner calls useInstanceInfo, which queries /settings/disk-usage. A
    // public-share token cannot read it (403), and cozy-client's useQuery does
    // not catch that rejection. PushBanner renders null on
    // public anyway, so it must not be mounted there at all.
    render(<Main isPublic>{[]}</Main>)

    expect(screen.queryByTestId('push-banner')).toBeNull()
  })

  it('mounts PushBanner on the authenticated route', () => {
    render(<Main isPublic={false}>{[]}</Main>)

    expect(screen.queryByTestId('push-banner')).not.toBeNull()
  })

  it('does not mount the migration banner when the flag is off', () => {
    flag.mockReturnValue(false)

    render(<Main isPublic={false}>{[]}</Main>)

    expect(screen.queryByTestId('migration-banner')).toBeNull()
    expect(screen.queryByTestId('realtime-queries')).toBeNull()
  })

  it('mounts the migration banner when the flag is on', () => {
    render(<Main isPublic={false}>{[]}</Main>)

    expect(screen.queryByTestId('migration-banner')).not.toBeNull()
    expect(screen.queryByTestId('realtime-queries')).not.toBeNull()
  })
})
