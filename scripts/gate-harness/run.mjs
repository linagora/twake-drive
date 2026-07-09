/**
 * run.mjs — Gate harness: drive the real Scribe inline prompt against the live
 * cozy-stack LLM proxy in series, parse + score each response with the PRODUCTION
 * measurement engine, and emit a probe-corpus envelope + aggregate for the GATE.
 *
 * Faithfulness model:
 *   - parseScribeResponse + scribeProbe (the MEASUREMENT) are loaded from the real
 *     src files at runtime via data: import — zero drift.
 *   - the prompt PREFIX is a verbatim copy in prompt.mjs, guarded by
 *     assertPromptInSync() against the live source (aborts on drift).
 *
 * Usage:
 *   node scripts/gate-harness/run.mjs [--domain alice.localhost:8080]
 *        [--concurrency 4] [--limit N] [--out path.json] [--temperature 0.3]
 *
 * Requires: cozy-stack CLI on PATH, the oo-dev / cozy-stack runtime up.
 * Writes to scripts/gate-harness/out/ by default. NEVER touches the curated
 * .planning/.../probe-corpus.json — merging is a deliberate, separate step.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { FIXTURES } from './fixtures.mjs'
import { buildMessages } from './prompt.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SRC = join(REPO, 'src/modules/views/OnlyOffice/Scribe')

// ── CLI args ───────────────────────────────────────────────────────────────
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const DOMAIN = arg('domain', 'alice.localhost:8080')
const CONCURRENCY = Number(arg('concurrency', '4'))
const LIMIT = Number(arg('limit', '0')) // 0 = all
const TEMPERATURE = Number(arg('temperature', '0.3'))
const SCOPE = 'io.cozy.ai.chat.conversations'

// ── Drift tripwire: verbatim prompt strings must still exist in live source ──
function assertPromptInSync() {
  const ai = readFileSync(join(SRC, 'scribeAI.js'), 'utf8')
  const actions = readFileSync(join(SRC, 'scribeActions.js'), 'utf8')
  const checks = [
    [ai, 'You are a writing assistant. Return only the transformed text'],
    [ai, 'Return ONLY a JSON object with exactly two keys'],
    [ai, 'Insertable/transformed text goes inside'],
    [ai, 'fragment holding the complete transformed text'],
    [ai, '0..N fragments: put any insertable content'],
    [ai, 'You are a helpful writing assistant. Help the user with their writing tasks.'],
    [ai, 'preserve all [TABLE:N]...[/TABLE] and [CELL:r,c]...[/CELL] markers'],
    [ai, 'preserve all [^scribe-fn-N] footnote reference markers'],
    [ai, 'preserve all {{REF:scribe-ref-N:visible text}} cross-reference markers'],
    [actions, 'Correct the grammar and spelling of the following text:'],
    [actions, 'Translate the following text to Deutsch:'],
    [actions, 'Rewrite the following text in a more professional tone:']
  ]
  const drifted = checks.filter(([hay, needle]) => !hay.includes(needle))
  if (drifted.length) {
    console.error('✗ PROMPT DRIFT — prompt.mjs is out of sync with production:')
    for (const [, n] of drifted) console.error(`    missing in source: "${n}"`)
    process.exit(2)
  }
}

// Load a real src ESM file without copying/modifying it (root pkg is CJS).
async function loadEsm(path) {
  const b64 = Buffer.from(readFileSync(path, 'utf8')).toString('base64')
  return import(`data:text/javascript;base64,${b64}`)
}

function mintToken(domain) {
  const out = execFileSync('cozy-stack', ['instances', 'token-cli', domain, SCOPE], {
    encoding: 'utf8'
  })
  const tok = out.trim()
  if (!tok) throw new Error('empty token from cozy-stack')
  return tok
}

async function callAI(domain, token, messages) {
  const res = await fetch(`http://${domain}/ai/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages, temperature: TEMPERATURE })
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const content = json?.content || json?.choices?.[0]?.message?.content
  if (!content) throw new Error('empty AI content')
  return { content, model: json?.model }
}

// Simple bounded-concurrency map preserving order.
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return out
}

async function main() {
  assertPromptInSync()
  const { parseScribeResponse } = await loadEsm(join(SRC, 'scribeResponse.js'))
  const probe = await loadEsm(join(SRC, 'scribeProbe.js'))
  const { replay, aggregate, PROBE_SCHEMA_VERSION } = probe

  const fixtures = LIMIT > 0 ? FIXTURES.slice(0, LIMIT) : FIXTURES
  const nChat = fixtures.filter(f => f.surface === 'chat').length
  console.log(`▶ gate-harness — ${fixtures.length} fixtures (${nChat} chat) → ${DOMAIN} (concurrency ${CONCURRENCY}, unified prompt)`)
  const token = mintToken(DOMAIN)

  let modelSeen = null
  const failures = []
  const results = await pool(fixtures, CONCURRENCY, async fx => {
    try {
      const messages = buildMessages(fx)
      const { content, model } = await callAI(DOMAIN, token, messages)
      if (model) modelSeen = model
      const parsed = parseScribeResponse(content, { surface: fx.surface })
      process.stdout.write(parsed.valid ? '.' : (parsed.fellBack ? 'f' : '?'))
      return {
        ts: Date.now(),
        surface: fx.surface,
        inputMd: fx.input,
        discussion: parsed.discussion,
        fragments: parsed.fragments,
        valid: parsed.valid,
        fellBack: parsed.fellBack,
        warnings: parsed.warnings,
        tags: fx.tags || { locale: fx.locale }
      }
    } catch (e) {
      process.stdout.write('x')
      failures.push({ id: fx.id, error: String(e.message || e) })
      return null
    }
  })
  process.stdout.write('\n')

  const samples = results.filter(Boolean)
  const envelope = { v: PROBE_SCHEMA_VERSION, samples }

  const outDir = join(HERE, 'out')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = arg('out', join(outDir, `corpus-${stamp}.json`))
  writeFileSync(outPath, JSON.stringify(envelope, null, 2))

  // Score with the production engine.
  const agg = aggregate(replay(envelope))
  console.log('\n── AGGREGATE (production scribeProbe) ──────────────────────')
  console.log(`model          : ${modelSeen || '(unknown)'}`)
  console.log(`samples        : ${agg.total}  (failures: ${failures.length})`)
  console.log(`dupRate        : ${(agg.dupRate * 100).toFixed(1)}%   (NO-GO if > 15% [ASSUMED])`)
  console.log(`preambleRate   : ${(agg.preambleRate * 100).toFixed(1)}%   (NO-GO if > 15% [ASSUMED])`)
  console.log(`splitTableCount: ${agg.splitTableCount}   (NO-GO if > 0)`)
  console.log(`refBrokenCount : ${agg.refBrokenCount}   (NO-GO if > 0)`)
  console.log(`fragDist       : 0=${agg.fragDist[0]} 1=${agg.fragDist[1]} N=${agg.fragDist.N}`)
  console.log(`coverage       : perLocale=${JSON.stringify(agg.coverage.perLocale)} tables=${agg.coverage.tableCases} refs=${agg.coverage.refCases}`)
  if (failures.length) {
    console.log('\n── FAILURES ───────────────────────────────────────────────')
    for (const f of failures) console.log(`  ${f.id}: ${f.error}`)
  }
  console.log(`\n✓ corpus written → ${outPath}`)
  console.log('  (curated .planning corpus is untouched — merge deliberately)')
}

main().catch(e => {
  console.error('✗ harness error:', e)
  process.exit(1)
})
