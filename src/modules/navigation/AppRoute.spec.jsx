import { BarRoutes } from 'cozy-bar'

// AppRoute strips cozy-bar's built-in assistant dialog route and mounts
// Drive's own full-page AssistantLayout on the same path. The filter matches
// cozy-bar's internal path string: if cozy-bar renames it, the filter would
// silently stop matching and both routes would register for the same URL.
// This test fails loudly instead.
describe('BarRoutes assistant route', () => {
  it('exposes exactly one route with the path AppRoute filters out', () => {
    const assistantRoutes = BarRoutes.filter(
      r => r.props?.path === 'assistant/:conversationId'
    )
    expect(assistantRoutes).toHaveLength(1)
  })
})
