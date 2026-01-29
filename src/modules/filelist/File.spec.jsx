'use strict'

import { render, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'

import { DumbFile } from './File'
import AppLike from 'test/components/AppLike'
import { folder, actionsMenu } from 'test/data'

jest.mock('cozy-sharing', () => ({
  ...jest.requireActual('cozy-sharing'),
  useSharingContext: jest.fn()
}))

useSharingContext.mockReturnValue({ byDocId: [] })

const client = createMockClient({
  clientOptions: {
    uri: 'http://cozy.localhost:8080/'
  },
  clientFunctions: {
    getInstanceOptions: () => ({
      subdomain: 'nested'
    })
  }
})

const setup = ({
  attributes = folder,
  actions = actionsMenu,
  selected = false,
  withSelectionCheckbox = true,
  selectionModeActive = false,
  onFileOpen = jest.fn(),
  onCheckboxToggle = jest.fn(),
  isInSyncFromSharing = false,
  disableSelection = false
} = {}) => {
  const root = render(
    <AppLike client={client}>
      <DumbFile
        attributes={attributes}
        actions={actions}
        selected={selected}
        withSelectionCheckbox={withSelectionCheckbox}
        selectionModeActive={selectionModeActive}
        onFileOpen={onFileOpen}
        onCheckboxToggle={onCheckboxToggle}
        isInSyncFromSharing={isInSyncFromSharing}
        disableSelection={disableSelection}
      />
    </AppLike>
  )
  return { root }
}

describe('File', () => {
  describe('default behavior', () => {
    it('should show a select box', () => {
      const { root } = setup()
      const { getByRole } = root

      expect(getByRole('checkbox'))
    })

    it('should not show spinner', () => {
      const { root } = setup()
      const { queryByTestId } = root

      expect(queryByTestId('fil-file-thumbnail--spinner')).toBeNull()
    })

    it('should show actions menu when clicking the actionsMenu button', async () => {
      // TODO : Fix https://github.com/cozy/cozy-drive/issues/2913
      jest.spyOn(console, 'warn').mockImplementation()
      let root
      await waitFor(async () => {
        root = setup().root
      })
      const { getByRole, findByText } = root

      await waitFor(async () => {
        fireEvent.click(getByRole('button', { name: 'More' }))
      })
      expect(await findByText('ActionsMenuItem'))
    })

    it('should not show select all in actions menu when clicking the actionsMenu button', async () => {
      let root
      await waitFor(async () => {
        root = setup().root
      })
      const { getByRole, queryByText } = root

      await waitFor(async () => {
        fireEvent.click(getByRole('button', { name: 'More' }))
      })
      // "SelectAllMenuItem" should be filtered out by File before rendering
      expect(queryByText('SelectAllMenuItem')).toBeNull()
    })

    it('should show select all in selection bar', () => {
      const { root } = setup()
      const { getByRole, queryByText } = root

      const checkbox = getByRole('checkbox')

      fireEvent.click(checkbox)

      expect(queryByText('SelectAllMenuItem'))
    })
  })

  describe('In sync from sharing behavior', () => {
    it('should show spinner', () => {
      const { root } = setup({ isInSyncFromSharing: true })
      const { getByTestId } = root

      expect(getByTestId('fil-file-thumbnail--spinner'))
    })

    it('should not show actions menu when clicking the actionsMenu button', async () => {
      let root
      await waitFor(async () => {
        root = setup({ isInSyncFromSharing: true }).root
      })
      const { getByRole, queryByText } = root

      await waitFor(async () => {
        fireEvent.click(getByRole('button', { name: 'More' }))
      })
      expect(queryByText('ActionsMenuItem')).toBeNull()
    })

    it('should not show a select box when syncing', () => {
      const { root } = setup({ isInSyncFromSharing: true })
      const { queryByRole } = root

      expect(queryByRole('checkbox')).toBeNull()
    })

    it('should not show a select box when selection disabled', () => {
      const { root } = setup({ disableSelection: true })
      const { queryByRole } = root

      expect(queryByRole('checkbox')).toBeNull()
    })

    it('should not have clickable sharing avatars', () => {
      const { root } = setup({ isInSyncFromSharing: true })
      const { getByTestId } = root

      expect(getByTestId('fil-content-sharestatus--noAvatar'))
    })
  })
})
