import { fireEvent, render, screen } from '@testing-library/react'
import React, { forwardRef } from 'react'

import { createMockClient } from 'cozy-client'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import VirtualizedCell from 'cozy-ui/transpiled/react/Table/Virtualized/Cell'

import AppLike from 'test/components/AppLike'

import Cell from '@/modules/filelist/virtualized/cells/Cell'
import { makeColumns } from '@/modules/views/Folder/helpers'

const file = { _id: 'file-id', _type: 'io.cozy.files', name: 'notes.txt' }

const renameAction = jest.fn()
const actions = [
  {
    rename: {
      name: 'rename',
      action: renameAction,
      Component: forwardRef(function Rename(props, ref) {
        return (
          <ActionsMenuItem {...props} ref={ref}>
            <ListItemText primary="Rename" />
          </ActionsMenuItem>
        )
      })
    }
  }
]

const setup = () => {
  const onRowClick = jest.fn()
  const onRowContextMenu = jest.fn()
  const columns = makeColumns(false)
  const menuColumn = columns.find(column => column.id === 'menu')

  render(
    <AppLike client={createMockClient({})}>
      <table>
        <tbody>
          <tr onContextMenu={onRowContextMenu}>
            <VirtualizedCell
              row={file}
              columns={columns}
              column={menuColumn}
              onClick={onRowClick}
            >
              <Cell actions={actions} />
            </VirtualizedCell>
          </tr>
        </tbody>
      </table>
    </AppLike>
  )

  return { onRowClick, onRowContextMenu }
}

describe('MenuCell', () => {
  it('opens the row menu without selecting the row', () => {
    const { onRowClick } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'More' }))

    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('runs a menu action without selecting the row', () => {
    const { onRowClick } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByText('Rename'))

    expect(renameAction).toHaveBeenCalled()
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('closes the row menu on an outside click without selecting the row', () => {
    const { onRowClick } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const menuBackdrop = screen.getByRole('presentation').firstChild
    fireEvent.click(menuBackdrop)

    expect(screen.queryByText('Rename')).toBe(null)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('keeps a right click in the row menu away from the row', () => {
    const { onRowContextMenu } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.contextMenu(screen.getByText('Rename'))

    expect(onRowContextMenu).not.toHaveBeenCalled()
  })
})
