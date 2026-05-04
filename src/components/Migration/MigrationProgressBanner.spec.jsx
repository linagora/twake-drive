import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

import { createMockClient, useQuery } from 'cozy-client'

import { MigrationProgressBanner } from './MigrationProgressBanner'
import AppLike from 'test/components/AppLike'

import logger from '@/lib/logger'

jest.mock('cozy-client', () => {
  const actual = jest.requireActual('cozy-client')
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useQuery: jest.fn()
  }
})

jest.mock('@/lib/logger', () => ({ error: jest.fn() }))

const RUNNING_DOC = {
  _id: 'migration-1',
  status: 'running',
  progress: {
    files_imported: 10,
    files_total: 100,
    bytes_imported: 1_000_000,
    bytes_total: 5_000_000
  }
}

const buildMockClient = ({ fetchJSON } = {}) => {
  const client = createMockClient({})
  const subscribers = {}
  const keyOf = (event, doctype, idOrHandler) =>
    typeof idOrHandler === 'string'
      ? `${event}:${doctype}:${idOrHandler}`
      : `${event}:${doctype}`
  client.plugins = {
    realtime: {
      subscribe: jest.fn((event, doctype, idOrHandler, handler) => {
        const key = keyOf(event, doctype, idOrHandler)
        subscribers[key] = handler || idOrHandler
      }),
      unsubscribe: jest.fn((event, doctype, idOrHandler) => {
        delete subscribers[keyOf(event, doctype, idOrHandler)]
      })
    }
  }
  client.__emit = (event, doctype, doc) => {
    const handler =
      subscribers[`${event}:${doctype}:${doc._id}`] ||
      subscribers[`${event}:${doctype}`]
    if (handler) handler(doc)
  }
  client.getStackClient = () => ({
    fetchJSON: fetchJSON || jest.fn().mockResolvedValue({})
  })
  return client
}

const setup = ({ runningMigration = null, fetchJSON } = {}) => {
  const client = buildMockClient({ fetchJSON })
  useQuery.mockReturnValue({
    data: runningMigration ? [runningMigration] : [],
    fetchStatus: 'loaded'
  })
  const utils = render(
    <AppLike client={client}>
      <MigrationProgressBanner />
    </AppLike>
  )
  const rerenderWith = nextRunning => {
    useQuery.mockReturnValue({
      data: nextRunning ? [nextRunning] : [],
      fetchStatus: 'loaded'
    })
    utils.rerender(
      <AppLike client={client}>
        <MigrationProgressBanner />
      </AppLike>
    )
  }
  return { client, rerenderWith, ...utils }
}

describe('MigrationProgressBanner', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('idle state', () => {
    it('does not render the banner when no migration is running', () => {
      setup()
      expect(
        screen.queryByTestId('migration-progress-banner-percent')
      ).not.toBeInTheDocument()
    })
  })

  describe('running state', () => {
    it('renders the banner when a migration is running', () => {
      // The ProgressionBanner of the cozy-ui version currently bundled in cozy-drive
      // declares `text: PropTypes.string` while we pass a fragment to keep the
      // `data-testid` wrapping. The next cozy-ui upgrade widens this to PropTypes.node.
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      try {
        setup({ runningMigration: RUNNING_DOC })
        expect(
          screen.getByTestId('migration-progress-banner-percent')
        ).toBeInTheDocument()
        expect(
          screen.getByTestId('migration-progress-banner-percent')
        ).toHaveTextContent('20% complete')
        expect(
          screen.getByTestId('migration-progress-banner-importing')
        ).toHaveTextContent('100 files')
      } finally {
        consoleErrorSpy.mockRestore()
      }
    })

    it('shows the banner when the query starts returning a running migration', () => {
      const { rerenderWith } = setup()
      expect(
        screen.queryByTestId('migration-progress-banner-percent')
      ).not.toBeInTheDocument()
      rerenderWith(RUNNING_DOC)
      expect(
        screen.getByTestId('migration-progress-banner-percent')
      ).toBeInTheDocument()
    })

    it('updates progress when the query data changes', () => {
      const { rerenderWith } = setup({ runningMigration: RUNNING_DOC })
      rerenderWith({
        ...RUNNING_DOC,
        progress: { ...RUNNING_DOC.progress, bytes_imported: 2_500_000 }
      })
      expect(
        screen.getByTestId('migration-progress-banner-percent')
      ).toHaveTextContent('50% complete')
    })
  })

  describe('terminal states', () => {
    it('hides the banner and shows the snackbar on completed', () => {
      const { client, rerenderWith } = setup({ runningMigration: RUNNING_DOC })
      act(() =>
        client.__emit('updated', 'io.cozy.nextcloud.migrations', {
          ...RUNNING_DOC,
          status: 'completed'
        })
      )
      rerenderWith(null)
      expect(
        screen.queryByTestId('migration-progress-banner-percent')
      ).not.toBeInTheDocument()
      expect(screen.getByText('Migration Complete!')).toBeInTheDocument()
    })

    it('hides the banner without snackbar when the running query empties', () => {
      const { rerenderWith } = setup({ runningMigration: RUNNING_DOC })
      rerenderWith(null)
      expect(
        screen.queryByTestId('migration-progress-banner-percent')
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Migration Complete!')).not.toBeInTheDocument()
    })
  })

  describe('cancel', () => {
    it('calls the cancel endpoint when the cancel button is clicked', async () => {
      const fetchJSON = jest.fn().mockResolvedValue({})
      setup({ runningMigration: RUNNING_DOC, fetchJSON })
      fireEvent.click(screen.getByTestId('migration-progress-banner-cancel'))
      await waitFor(() =>
        expect(fetchJSON).toHaveBeenCalledWith(
          'POST',
          '/remote/nextcloud/migration/migration-1/cancel'
        )
      )
    })

    it('silently ignores a 409 response', async () => {
      const fetchJSON = jest.fn().mockRejectedValue({ status: 409 })
      setup({ runningMigration: RUNNING_DOC, fetchJSON })
      fireEvent.click(screen.getByTestId('migration-progress-banner-cancel'))
      await waitFor(() => expect(fetchJSON).toHaveBeenCalled())
      expect(logger.error).not.toHaveBeenCalled()
    })

    it('logs other errors', async () => {
      const fetchJSON = jest.fn().mockRejectedValue({ status: 500 })
      setup({ runningMigration: RUNNING_DOC, fetchJSON })
      fireEvent.click(screen.getByTestId('migration-progress-banner-cancel'))
      await waitFor(() => expect(logger.error).toHaveBeenCalled())
    })
  })
})
