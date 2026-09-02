import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import { FilePickerRecentsContent } from './FilePickerRecentsContent'

import useRecentFiles from '@/hooks/useRecentFiles'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

jest.mock('@/hooks/useRecentFiles')
jest.mock('@/modules/selection/SelectionProvider', () => ({
  useSelectionContext: jest.fn()
}))

const rootBreadcrumbPath = { id: 'recents-root', name: 'Recents' }
const localFile = { _id: 'local-id', name: 'Local file' }
const sharedFile = {
  _id: 'shared-id',
  name: 'Shared file',
  driveId: 'drive-id'
}

function renderContent(source) {
  return (
    <div>
      <span data-testid="items">
        {source.items.map(item => item._id).join()}
      </span>
      <span data-testid="status">{source.fetchStatus}</span>
      <span data-testid="breadcrumb">{source.breadcrumbPath[0].name}</span>
      <span data-testid="has-more">{String(source.hasMore)}</span>
      <span data-testid="fetch-more">{String(source.fetchMore)}</span>
      <span data-testid="with-file-path">{String(source.withFilePath)}</span>
      <span data-testid="fetching-more">{String(source.isFetchingMore)}</span>
      <span data-testid="keep-items-on-error">
        {String(source.keepItemsOnError)}
      </span>
      <span data-testid="empty-message">{source.emptyMessageKey}</span>
      <span data-testid="error-message">{source.errorMessageKey}</span>
      <span data-testid="disabled">
        {String(source.isItemDisabled(source.items[0]))}
      </span>
    </div>
  )
}

function setup({ data = [], fetchStatus = 'loaded', selectedItems = [] } = {}) {
  const setIsSelectAll = jest.fn()
  const setSelectedItems = jest.fn()
  useRecentFiles.mockReturnValue({ data, fetchStatus, error: null })
  useSelectionContext.mockReturnValue({
    selectedItems,
    setIsSelectAll,
    setSelectedItems
  })

  return {
    setIsSelectAll,
    setSelectedItems,
    ...render(
      <FilePickerRecentsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
        renderContent={renderContent}
      />
    )
  }
}

describe('FilePickerRecentsContent', () => {
  afterEach(() => jest.clearAllMocks())

  it('passes recent files through in source order with their driveId', () => {
    const data = [sharedFile, localFile]
    setup({ data })

    expect(useRecentFiles).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('items')).toHaveTextContent('shared-id,local-id')
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent('Recents')
    expect(screen.getByTestId('has-more')).toHaveTextContent('false')
    expect(screen.getByTestId('fetch-more')).toHaveTextContent('null')
    expect(screen.getByTestId('with-file-path')).toHaveTextContent('true')
    expect(screen.getByTestId('keep-items-on-error')).toHaveTextContent('true')
    expect(screen.getByTestId('disabled')).toHaveTextContent('false')
    expect(data[0]).toBe(sharedFile)
    expect(data[0].driveId).toBe('drive-id')
  })

  it.each([
    ['loading', [], false],
    ['loading', [localFile], true],
    ['loaded', [localFile], false],
    ['loaded', [], false],
    ['error', [localFile], false],
    ['error', [], false]
  ])(
    'maps %s with %i items to the Recents source state',
    (fetchStatus, data, isFetchingMore) => {
      setup({ data, fetchStatus })

      expect(screen.getByTestId('status')).toHaveTextContent(fetchStatus)
      expect(screen.getByTestId('fetching-more')).toHaveTextContent(
        String(isFetchingMore)
      )
      expect(screen.getByTestId('empty-message')).toHaveTextContent(
        'FilePicker.recents.empty'
      )
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'FilePicker.recents.error'
      )
    }
  )

  it('reconciles selection only after enrichment becomes terminal', async () => {
    const setIsSelectAll = jest.fn()
    const setSelectedItems = jest.fn()
    let recentResult = {
      data: [sharedFile, localFile],
      fetchStatus: 'loading',
      error: null
    }
    useRecentFiles.mockImplementation(() => recentResult)
    useSelectionContext.mockReturnValue({
      selectedItems: [sharedFile],
      setIsSelectAll,
      setSelectedItems
    })

    const view = render(
      <FilePickerRecentsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
        renderContent={renderContent}
      />
    )

    recentResult = {
      data: [localFile],
      fetchStatus: 'loading',
      error: null
    }
    view.rerender(
      <FilePickerRecentsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
        renderContent={renderContent}
      />
    )
    expect(setSelectedItems).not.toHaveBeenCalled()

    recentResult = {
      data: [{ ...sharedFile, name: 'Enriched shared file' }, localFile],
      fetchStatus: 'loaded',
      error: null
    }
    view.rerender(
      <FilePickerRecentsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
        renderContent={renderContent}
      />
    )
    expect(setSelectedItems).not.toHaveBeenCalled()
    expect(sharedFile.driveId).toBe('drive-id')

    recentResult = { data: [localFile], fetchStatus: 'loaded', error: null }
    view.rerender(
      <FilePickerRecentsContent
        rootBreadcrumbPath={rootBreadcrumbPath}
        renderContent={renderContent}
      />
    )

    await waitFor(() => expect(setSelectedItems).toHaveBeenCalledWith({}))
    expect(setIsSelectAll).toHaveBeenCalledWith(false)
  })
})
