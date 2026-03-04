import { renderHook } from '@testing-library/react'
import React from 'react'

import { createMockClient, models } from 'cozy-client'

import { useExtraColumns } from './useExtraColumns'
import AppLike from 'test/components/AppLike'

const client = createMockClient({})
client.query = jest.fn()

const setup = ({ columnsNames, queryBuilder, conditionBuilder, files }) => {
  const wrapper = ({ children }) => (
    <AppLike client={client}>{children}</AppLike>
  )

  return renderHook(
    () =>
      useExtraColumns({
        columnsNames,
        queryBuilder,
        conditionBuilder,
        currentFolderId: '123',
        sharedDocumentIds: '456',
        files
      }),
    {
      wrapper
    }
  )
}

describe('useExtraColumns', () => {
  it('should return error if no queryBuilder or conditionBuilder passed', () => {
    jest.spyOn(console, 'error').mockImplementation()
    expect(() => setup({ columnsNames: ['carbonCopy'] })).toThrow(
      'useExtraColumns must have queryBuilder or conditionBuilder'
    )
  })
})

describe('useExtraColumns : queryBuilder', () => {
  it('should not query anything if no queryBuilder passed', () => {
    jest.spyOn(console, 'error').mockImplementation()
    expect(() => setup({ columnsNames: ['carbonCopy'] })).toThrow()
    expect(client.query).not.toHaveBeenCalled()
  })

  it('should execute query if queryBuilder passed', async () => {
    setup({
      columnsNames: ['carbonCopy'],
      queryBuilder: () => ({
        definition: () => 'queryDefinition',
        options: 'queryOptions'
      })
    })

    expect(client.query).toHaveBeenCalled()
  })

  it('should return carbonCopy column if the query result returns at least one file', async () => {
    // mock returned value for query checking if at least one file as carbonCopy metadata
    client.getQueryFromState = jest.fn(() => ({
      fetchStatus: 'loaded',
      data: [{ id: '01', metadata: { carbonCopy: true } }]
    }))

    const { result } = setup({
      columnsNames: ['carbonCopy'],
      queryBuilder: () => ({
        definition: () => 'queryDefinition',
        options: 'queryOptions'
      })
    })

    expect(
      result.current.some(extraColumn => extraColumn.label === 'carbonCopy')
    ).toBeTruthy()
  })
})

describe('useExtraColumns : conditionBuilder', () => {
  const conditionBuilder = ({ files, attribute }) =>
    files.some(file => models.file.hasMetadataAttribute({ file, attribute }))

  it('should return empty array if no files', async () => {
    const { result } = setup({
      columnsNames: ['carbonCopy'],
      conditionBuilder,
      files: []
    })

    expect(result.current).toMatchObject([])
  })

  it('should return empty array if no columns names', async () => {
    const { result } = setup({
      columnsNames: [],
      conditionBuilder,
      files: [{ id: '01' }]
    })

    expect(result.current).toMatchObject([])
  })

  it('should return empty array if no files with matching metadata', async () => {
    const { result } = setup({
      columnsNames: ['carbonCopy'],
      conditionBuilder,
      files: [{ id: '01' }]
    })

    expect(result.current).toMatchObject([])
  })

  it('should return carbonCopy column if at least one file has carbonCopy metadata', async () => {
    const { result } = setup({
      columnsNames: ['carbonCopy'],
      conditionBuilder,
      files: [{ id: '01', metadata: { carbonCopy: true } }]
    })

    expect(
      result.current.some(extraColumn => extraColumn.label === 'carbonCopy')
    ).toBeTruthy()
  })

  it('should not return carbonCopy column if this column is not wanted, even if a file has carbonCopy metadata', async () => {
    const { result } = setup({
      columnsNames: ['electronicSafe'],
      conditionBuilder,
      files: [{ id: '01', metadata: { carbonCopy: true } }]
    })

    expect(result.current).toMatchObject([])
  })
})
