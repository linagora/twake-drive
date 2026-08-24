import type { ContactFilterOption } from './ContactFilter.types'
import { filterContactFilterOptions } from './contactFilterOptions'

const OPTIONS = [
  {
    avatar: null,
    label: 'Élodie Martin',
    secondaryLabel: 'elodie@example.com',
    value: 'contact:elodie'
  },
  {
    avatar: null,
    label: 'Thomas Jolly',
    searchableValues: ['Thomas Alexandre Jolly'],
    secondaryLabel: 'tdesign25@gmail.com',
    value: 'contact:thomas'
  }
] satisfies ContactFilterOption[]

function makeOptions(length: number): ContactFilterOption[] {
  return Array.from(
    { length },
    (_value: unknown, index: number): ContactFilterOption => ({
      avatar: null,
      label: `Contact ${index + 1}`,
      value: `contact:${index + 1}`
    })
  )
}

describe('filterContactFilterOptions', () => {
  it('matches labels without accents and secondary labels', () => {
    expect(filterContactFilterOptions(OPTIONS, 'elodie')).toEqual([OPTIONS[0]])
    expect(filterContactFilterOptions(OPTIONS, 'tdesign25')).toEqual([
      OPTIONS[1]
    ])
  })

  it('matches additional searchable values without displaying them', () => {
    expect(filterContactFilterOptions(OPTIONS, 'alexandre')).toEqual([
      OPTIONS[1]
    ])
  })

  it('limits empty search results to 20 options', () => {
    expect(filterContactFilterOptions(makeOptions(25), '')).toHaveLength(20)
  })

  it('finds an option beyond the initial result limit', () => {
    const options = makeOptions(25)

    expect(filterContactFilterOptions(options, 'Contact 25')).toEqual([
      options[24]
    ])
  })
})
