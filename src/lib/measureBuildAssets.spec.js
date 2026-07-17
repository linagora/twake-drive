import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { gzipSync } from 'zlib'

const SCRIPT_PATH = path.resolve('scripts/measureBuildAssets.mjs')

const saveFixtureFile = (buildDir, relativePath, content) => {
  const filePath = path.join(buildDir, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

const runMeasurement = (buildDir, arguments_ = []) => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT_PATH, '--build-dir', buildDir, ...arguments_],
    { encoding: 'utf8' }
  )

  if (result.status !== 0) {
    throw new Error(result.stderr.trim())
  }

  return result.stdout
}

const parseBuildReport = buildDir => {
  return JSON.parse(runMeasurement(buildDir, ['--json']))
}

const computeGzipSize = content => gzipSync(content, { level: 9 }).byteLength

describe('measureBuildAssets command', () => {
  let buildDir

  beforeEach(() => {
    buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-build-metrics-'))

    saveFixtureFile(
      buildDir,
      'index.html',
      '<link href="/static/main.css?v=1" rel="stylesheet"><script src="/static/shared.js"></script><script src="/static/main.js"></script>'
    )
    saveFixtureFile(
      buildDir,
      'public/index.html',
      '<link rel="stylesheet" href="../static/public.css"><script src="../static/shared.js"></script><script src="../static/public.js"></script>'
    )
    saveFixtureFile(
      buildDir,
      'intents/index.html',
      '<link rel="stylesheet" href="/static/intent.css"><link rel="stylesheet" href="DATA:text/css,body{}"><script src="/static/shared.js?hash=1"></script><script src="/static/shared.js"></script><script src="/static/intent.js"></script><script src="https://cdn.example/ignored.js"></script>'
    )
    saveFixtureFile(buildDir, 'static/shared.js', 'shared')
    saveFixtureFile(buildDir, 'static/main.js', 'main')
    saveFixtureFile(buildDir, 'static/public.js', 'public')
    saveFixtureFile(buildDir, 'static/intent.js', 'intent')
    saveFixtureFile(buildDir, 'static/async.js', 'not initially loaded')
    saveFixtureFile(buildDir, 'static/main.css', 'main css')
    saveFixtureFile(buildDir, 'static/public.css', 'public css')
    saveFixtureFile(buildDir, 'static/intent.css', 'intent css')
    saveFixtureFile(buildDir, 'manifest.webapp', '{}')
  })

  afterEach(() => {
    fs.rmSync(buildDir, { recursive: true, force: true })
  })

  it('reports stable entrypoint, generated output, and registry metrics', () => {
    const firstReport = parseBuildReport(buildDir)
    const secondReport = parseBuildReport(buildDir)

    expect(secondReport).toEqual(firstReport)
    expect(firstReport.entrypoints.intents).toEqual({
      html: 'intents/index.html',
      assets: ['static/intent.css', 'static/shared.js', 'static/intent.js'],
      requests: {
        javascript: 2,
        stylesheets: 1,
        total: 3
      },
      bytes: {
        uncompressed:
          Buffer.byteLength('intent css') +
          Buffer.byteLength('shared') +
          Buffer.byteLength('intent'),
        gzip:
          computeGzipSize('intent css') +
          computeGzipSize('shared') +
          computeGzipSize('intent'),
        javascript: {
          uncompressed:
            Buffer.byteLength('shared') + Buffer.byteLength('intent'),
          gzip: computeGzipSize('shared') + computeGzipSize('intent')
        },
        stylesheets: {
          uncompressed: Buffer.byteLength('intent css'),
          gzip: computeGzipSize('intent css')
        },
        total: {
          uncompressed:
            Buffer.byteLength('intent css') +
            Buffer.byteLength('shared') +
            Buffer.byteLength('intent'),
          gzip:
            computeGzipSize('intent css') +
            computeGzipSize('shared') +
            computeGzipSize('intent')
        }
      },
      initialJavaScript: {
        files: 2,
        bytes: {
          uncompressed:
            Buffer.byteLength('shared') + Buffer.byteLength('intent'),
          gzip: computeGzipSize('shared') + computeGzipSize('intent')
        },
        gzipKiB: (computeGzipSize('shared') + computeGzipSize('intent')) / 1024
      }
    })
    expect(firstReport.entrypoints.main.requests.total).toBe(3)
    expect(firstReport.entrypoints.public.requests.total).toBe(3)
    expect(firstReport.entrypoints.main.bytes.javascript).toEqual({
      uncompressed: Buffer.byteLength('shared') + Buffer.byteLength('main'),
      gzip: computeGzipSize('shared') + computeGzipSize('main')
    })
    expect(firstReport.entrypoints.public.bytes.stylesheets).toEqual({
      uncompressed: Buffer.byteLength('public css'),
      gzip: computeGzipSize('public css')
    })
    expect(firstReport.generated.javascript.bytes.gzip).toBe(
      ['shared', 'main', 'public', 'intent', 'not initially loaded'].reduce(
        (total, content) => total + computeGzipSize(content),
        0
      )
    )
    expect(firstReport.generated.javascript.files).toBe(5)
    expect(firstReport.generated.stylesheets.files).toBe(3)
    expect(firstReport.generated.total.files).toBe(8)
    expect(firstReport.generated.total.bytes.uncompressed).toBe(
      ['shared', 'main', 'public', 'intent', 'not initially loaded'].reduce(
        (total, content) => total + Buffer.byteLength(content),
        0
      ) +
        ['main css', 'public css', 'intent css'].reduce(
          (total, content) => total + Buffer.byteLength(content),
          0
        )
    )
    expect(firstReport.registry.files).toBe(12)
    expect(firstReport.registry.bytes.uncompressed).toBeGreaterThan(0)
    expect(firstReport.registry.bytes.gzip).toBeGreaterThan(0)
  })

  it('prints a human-readable comparison summary by default', () => {
    const output = runMeasurement(buildDir)

    expect(output).toContain('Entrypoint  JS requests  CSS requests')
    expect(output).toContain('main')
    expect(output).toContain('public')
    expect(output).toContain('intents')
    expect(output).toContain('Initial JavaScript (intents):')
    expect(output).toContain('Generated JS + CSS:')
    expect(output).toContain('Registry artifact:')
  })

  it('fails when an entrypoint references a missing asset', () => {
    fs.rmSync(path.join(buildDir, 'static/intent.js'))

    expect(() => runMeasurement(buildDir, ['--json'])).toThrow(
      'intents/index.html references missing asset static/intent.js'
    )
  })
})
