import { renderHook } from '@testing-library/react'
import React from 'react'

import {
  FileParentFolderProvider,
  useParentFolderPath
} from './FileParentFolderContext'

import { ROOT_DIR_ID } from '@/constants/config'

describe('useParentFolderPath', () => {
  const file = {
    _id: 'file-1',
    name: 'a.txt',
    dir_id: 'dir-1',
    path: '/A/a.txt'
  }

  it('gives the full parent path by default', () => {
    const { result } = renderHook(() => useParentFolderPath())

    expect(result.current(file)).toBe('/A')
    expect(result.current({ ...file, dir_id: ROOT_DIR_ID })).toBe('/')
  })

  it('gives the parent path chosen by the view', () => {
    const wrapper = ({ children }) => (
      <FileParentFolderProvider getParentFolderPath={() => 'A'}>
        {children}
      </FileParentFolderProvider>
    )

    const { result } = renderHook(() => useParentFolderPath(), { wrapper })

    expect(result.current(file)).toBe('A')
  })
})
