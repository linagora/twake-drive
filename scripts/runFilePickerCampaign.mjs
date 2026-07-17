#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const usage =
  'Usage: node scripts/runFilePickerCampaign.mjs --output <file> --variant name=path [--variant name=path ...]'

const args = process.argv.slice(2)
const outputIndex = args.indexOf('--output')
if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error(usage)
const outputPath = path.resolve(args[outputIndex + 1])
const variants = []
for (let index = 0; index < args.length; index += 1) {
  if (args[index] !== '--variant') continue
  const value = args[index + 1]
  const separator = value?.indexOf('=') ?? -1
  if (separator < 1) throw new Error(usage)
  variants.push({
    name: value.slice(0, separator),
    directory: path.resolve(value.slice(separator + 1))
  })
  index += 1
}
if (variants.length === 0) throw new Error(usage)

const run = (command, commandArgs, options = {}) =>
  execFileSync(command, commandArgs, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: options.encoding ?? 'utf8',
    stdio: options.stdio ?? 'pipe'
  })

const git = (directory, ...gitArgs) =>
  run('git', ['-C', directory, ...gitArgs]).trim()
const stackImage = () => {
  try {
    const output = run('docker', [
      'compose',
      '--file',
      'docker-compose.e2e.yml',
      'images',
      'cozystack',
      '--format',
      'json'
    ]).trim()
    return output && output !== 'null' ? JSON.parse(output) : null
  } catch {
    return null
  }
}

const repositoryDirectory = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
)
const campaignTestSource = path.join(
  repositoryDirectory,
  'e2e/tests/intent-startup-performance.spec.ts'
)
const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'drive-file-picker-campaign-')
)
const results = []
try {
  for (const variant of variants) {
    if (!fs.existsSync(variant.directory)) {
      throw new Error(`Variant directory does not exist: ${variant.directory}`)
    }
    const revision = git(variant.directory, 'rev-parse', 'HEAD')
    const buildReportPath = path.join(
      temporaryDirectory,
      `${variant.name}-build.json`
    )
    const startupReportPath = path.join(
      temporaryDirectory,
      `${variant.name}-startup.json`
    )

    process.stdout.write(`\n[campaign] ${variant.name} (${revision})\n`)
    run(
      'yarn',
      [
        'test',
        '--runInBand',
        'src/modules/services/components/Picker.spec.jsx',
        'src/modules/services/components/FilePicker/useFilePickerSelection.spec.jsx',
        'src/targets/intents/loadIntentLocales.spec.js'
      ],
      { cwd: variant.directory, stdio: 'inherit' }
    )
    run('yarn', ['build'], { cwd: variant.directory, stdio: 'inherit' })
    const buildReport = JSON.parse(
      run('node', ['scripts/measureBuildAssets.mjs', '--json'], {
        cwd: variant.directory
      })
    )
    fs.writeFileSync(
      buildReportPath,
      `${JSON.stringify(buildReport, null, 2)}\n`
    )
    const performanceTest = path.join(
      variant.directory,
      'e2e/tests/intent-startup-performance.spec.ts'
    )
    const performanceConfig = path.join(
      variant.directory,
      'e2e/playwright.config.ts'
    )
    const originalPerformanceTest = fs.readFileSync(performanceTest)
    fs.copyFileSync(campaignTestSource, performanceTest)
    try {
      run(
        'yarn',
        ['playwright', 'test', performanceTest, '--config', performanceConfig],
        {
          cwd: variant.directory,
          env: {
            E2E_PERSIST: '1',
            E2E_PERFORMANCE: '1',
            E2E_PROJECT_NAME: 'drive-file-picker-campaign',
            PERFORMANCE_VARIANT: variant.name,
            PERFORMANCE_OUTPUT: startupReportPath
          },
          stdio: 'inherit'
        }
      )
    } finally {
      fs.writeFileSync(performanceTest, originalPerformanceTest)
    }
    const startupReport = JSON.parse(fs.readFileSync(startupReportPath, 'utf8'))
    results.push({
      variant: variant.name,
      directory: variant.directory,
      gitRevision: revision,
      build: buildReport,
      startup: startupReport
    })
  }

  const report = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    host: {
      hostname: os.hostname(),
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      cpu: os.cpus()[0]?.model ?? null,
      cpuCount: os.cpus().length,
      memoryBytes: os.totalmem()
    },
    software: {
      node: process.version,
      yarn: run('yarn', ['--version']).trim(),
      cozyStackImage: stackImage(),
      throttling: {
        network: '40ms latency, 1.5Mbps down, 750Kbps up',
        cpu: '4x'
      }
    },
    variants: results
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`[campaign] wrote ${outputPath}\n`)
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
