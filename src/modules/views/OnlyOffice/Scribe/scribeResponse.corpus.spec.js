/**
 * scribeResponse.corpus.spec.js — Deterministic regression suite over the static
 * malformed-response corpus (D-07). Runs every fixture in SCRIBE_RESPONSE_FIXTURES
 * through parseScribeResponse and asserts the documented parse outcome.
 *
 * This suite is SEPARATE from:
 *   - scribeResponse.spec.js  (single-example parser unit tests — not duplicated)
 *   - the live model-measuring GATE harness (under scripts/)
 *
 * It uses only static fixtures (no network, no model), so it is fully reproducible
 * and acts as a regression net locking parser tolerance against future drift.
 */
import { parseScribeResponse } from './scribeResponse'
import { SCRIBE_RESPONSE_FIXTURES } from './scribeResponse.fixtures'

const ALL_CATEGORIES = [
  'brokenRef',
  'fence',
  'nonJsonProse',
  'preamble',
  'splitTable',
  'trailingComma'
]

describe('scribeResponse — static malformed-response corpus (D-07)', () => {
  it('exposes exactly the six D-07 categories', () => {
    expect(Object.keys(SCRIBE_RESPONSE_FIXTURES).sort()).toEqual(ALL_CATEGORIES)
  })

  describe.each(ALL_CATEGORIES)('category: %s', category => {
    it('is a non-empty array of fixtures', () => {
      expect(Array.isArray(SCRIBE_RESPONSE_FIXTURES[category])).toBe(true)
      expect(SCRIBE_RESPONSE_FIXTURES[category].length).toBeGreaterThan(0)
    })

    it.each(SCRIBE_RESPONSE_FIXTURES[category].map(f => [f.name, f]))(
      '%s',
      (_name, fixture) => {
        const r = parseScribeResponse(fixture.raw, { surface: fixture.surface })

        // Never throws — result is always a documented object.
        expect(typeof r).toBe('object')
        expect(r).not.toBeNull()

        // Core asserted outcome (always present on every fixture).
        expect(r.fellBack).toBe(fixture.expect.fellBack)
        expect(r.valid).toBe(fixture.expect.valid)

        // Optional deeper assertions.
        if (fixture.expect.discussion !== undefined) {
          expect(r.discussion).toBe(fixture.expect.discussion)
        }
        if (fixture.expect.fragments !== undefined) {
          expect(r.fragments).toEqual(fixture.expect.fragments)
        }
        if (fixture.expect.warningsInclude) {
          for (const w of fixture.expect.warningsInclude) {
            expect(r.warnings).toContain(w)
          }
        }
        if (fixture.expect.fragmentsContain) {
          for (const needle of fixture.expect.fragmentsContain) {
            expect(r.fragments.some(frag => frag.includes(needle))).toBe(true)
          }
        }
      }
    )
  })

  describe('splitTable category invariants', () => {
    it.each(SCRIBE_RESPONSE_FIXTURES.splitTable.map(f => [f.name, f]))(
      '%s → valid:false and warnings include split-table',
      (_name, fixture) => {
        const r = parseScribeResponse(fixture.raw, { surface: fixture.surface })
        expect(r.valid).toBe(false)
        expect(r.warnings).toContain('split-table')
      }
    )
  })

  describe('nonJsonProse surface-specific fallback', () => {
    it.each(SCRIBE_RESPONSE_FIXTURES.nonJsonProse.map(f => [f.name, f]))(
      '%s → surface-specific fallback shape',
      (_name, fixture) => {
        const r = parseScribeResponse(fixture.raw, { surface: fixture.surface })
        expect(r.fellBack).toBe(true)
        if (fixture.surface === 'popover') {
          // popover fallback: raw becomes a single fragment, discussion empty.
          expect(r.fragments).toEqual([fixture.raw])
          expect(r.discussion).toBe('')
        } else {
          // chat (and any non-popover) fallback: raw becomes the discussion.
          expect(r.discussion).toBe(fixture.raw)
          expect(r.fragments).toEqual([])
        }
      }
    )
  })
})

/**
 * D-08 fence fellBack RE-MEASURE.
 *
 * A response whose ONLY defect is a wrapping code fence MUST parse successfully
 * (fellBack === false) — it must NEVER fall back. This block re-measures the
 * ~2% code-fence reliquat observed in STATE.md ("model wraps JSON in a ```json
 * fence") over the `fence` corpus and asserts a 0% fallback rate.
 *
 * The fence category includes the verbatim real-reliquat sample from STATE.md
 * (tagged in its name), so this 0% measurement is anchored to a real model
 * output and not only to author-invented shapes the existing stripFence happens
 * to already handle.
 */
describe('fellBack rate — code-fence reliquat re-measure (D-08)', () => {
  it('includes the verbatim real-reliquat sample observed in STATE.md', () => {
    const realSample = SCRIBE_RESPONSE_FIXTURES.fence.find(f =>
      /real-reliquat/i.test(f.name)
    )
    expect(realSample).toBeDefined()
    expect(realSample.raw).toContain('```json')
  })

  it('includes the three required fence shapes (language-tag, trailing-whitespace, no-trailing-newline)', () => {
    const names = SCRIBE_RESPONSE_FIXTURES.fence.map(f => f.name)
    expect(names.some(n => /language tag/i.test(n))).toBe(true)
    expect(names.some(n => /trailing whitespace/i.test(n))).toBe(true)
    expect(names.some(n => /no trailing newline/i.test(n))).toBe(true)
  })

  it.each(SCRIBE_RESPONSE_FIXTURES.fence.map(f => [f.name, f]))(
    'fence-only defect parses with fellBack=false: %s',
    (_name, fixture) => {
      const r = parseScribeResponse(fixture.raw, { surface: fixture.surface })
      expect(r.fellBack).toBe(false)
    }
  )

  it('measures a 0% fallback rate across the entire fence corpus', () => {
    const fenceFixtures = SCRIBE_RESPONSE_FIXTURES.fence
    const fellBackCount = fenceFixtures.filter(
      f =>
        parseScribeResponse(f.raw, { surface: f.surface }).fellBack === true
    ).length
    expect(fellBackCount).toBe(0)
  })
})
