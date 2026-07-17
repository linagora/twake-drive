#!/usr/bin/env node

import fs from 'fs'
import os from 'os'
import path from 'path'
import { gzipSync } from 'zlib'

import { create as createTarArchive } from 'tar'

const ENTRYPOINT_HTML = {
  main: 'index.html',
  public: 'public/index.html',
  intents: 'intents/index.html'
}

const parseCommandOptions = args => {
  const options = {
    buildDir: 'build',
    json: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === '--json') {
      options.json = true
      continue
    }

    if (argument === '--build-dir') {
      const buildDir = args[index + 1]
      if (!buildDir) {
        throw new Error('--build-dir requires a path')
      }
      options.buildDir = buildDir
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

const parseTagAttributes = tag => {
  const attributes = {}
  const content = tag.replace(/^<\s*\w+\s*/u, '').replace(/\s*\/?>$/u, '')
  const attributePattern =
    /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu

  for (const match of content.matchAll(attributePattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? ''
  }

  return attributes
}

const normalizeAssetPath = (htmlPath, assetUrl) => {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(assetUrl)) {
    return null
  }

  const pathWithoutQuery = assetUrl.split(/[?#]/u, 1)[0]
  const assetPath = pathWithoutQuery.startsWith('/')
    ? pathWithoutQuery.slice(1)
    : path.posix.join(path.posix.dirname(htmlPath), pathWithoutQuery)
  const normalizedPath = path.posix.normalize(assetPath)

  if (normalizedPath.startsWith('../')) {
    throw new Error(`Asset path leaves the build directory: ${assetUrl}`)
  }

  return normalizedPath
}

const parseHtmlAssetPaths = (html, htmlPath) => {
  const assetPaths = []
  const tags = html.match(/<(?:script|link)\b[^>]*>/giu) ?? []

  for (const tag of tags) {
    const attributes = parseTagAttributes(tag)
    const isScript = /^<script\b/iu.test(tag) && attributes.src
    const isStylesheet =
      /^<link\b/iu.test(tag) &&
      attributes.href &&
      attributes.rel?.toLowerCase().split(/\s+/u).includes('stylesheet')
    const assetUrl = isScript
      ? attributes.src
      : isStylesheet
        ? attributes.href
        : null

    if (!assetUrl) continue

    const assetPath = normalizeAssetPath(htmlPath, assetUrl)
    if (assetPath && !assetPaths.includes(assetPath)) {
      assetPaths.push(assetPath)
    }
  }

  return assetPaths
}

const listFilePaths = directory => {
  const filePaths = []

  const visitDirectory = currentDirectory => {
    const entries = fs
      .readdirSync(currentDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name)
      if (entry.isDirectory()) {
        visitDirectory(entryPath)
      } else if (entry.isFile()) {
        filePaths.push(entryPath)
      }
    }
  }

  visitDirectory(directory)
  return filePaths
}

const measureFiles = filePaths => {
  return filePaths.reduce(
    (metrics, filePath) => {
      const content = fs.readFileSync(filePath)
      metrics.files += 1
      metrics.bytes.uncompressed += content.byteLength
      metrics.bytes.gzip += gzipSync(content, { level: 9 }).byteLength
      return metrics
    },
    {
      files: 0,
      bytes: {
        uncompressed: 0,
        gzip: 0
      }
    }
  )
}

const measureEntrypoint = (buildDir, htmlPath) => {
  const absoluteHtmlPath = path.join(buildDir, htmlPath)
  const html = fs.readFileSync(absoluteHtmlPath, 'utf8')
  const assets = parseHtmlAssetPaths(html, htmlPath)
  const absoluteAssetPaths = assets.map(assetPath => {
    const absoluteAssetPath = path.join(buildDir, assetPath)
    if (!fs.existsSync(absoluteAssetPath)) {
      throw new Error(`${htmlPath} references missing asset ${assetPath}`)
    }
    return absoluteAssetPath
  })
  const javascriptPaths = absoluteAssetPaths.filter(
    filePath => path.extname(filePath).toLowerCase() === '.js'
  )
  const stylesheetPaths = absoluteAssetPaths.filter(
    filePath => path.extname(filePath).toLowerCase() === '.css'
  )
  const javascript = measureFiles(javascriptPaths)
  const stylesheets = measureFiles(stylesheetPaths)
  const total = measureFiles(absoluteAssetPaths)

  return {
    html: htmlPath,
    assets,
    requests: {
      javascript: javascript.files,
      stylesheets: stylesheets.files,
      total: assets.length
    },
    // Keep the combined values for consumers of the original report schema.
    bytes: {
      uncompressed: total.bytes.uncompressed,
      gzip: total.bytes.gzip,
      javascript: javascript.bytes,
      stylesheets: stylesheets.bytes,
      total: total.bytes
    },
    initialJavaScript: {
      files: javascript.files,
      bytes: javascript.bytes,
      gzipKiB: javascript.bytes.gzip / 1024
    }
  }
}

const measureRegistryArchive = async (buildDir, filePaths) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'drive-registry-metrics-')
  )
  const archivePath = path.join(temporaryDirectory, 'drive.tar.gz')
  const relativeFilePaths = filePaths.map(filePath =>
    path.relative(buildDir, filePath)
  )

  try {
    await createTarArchive(
      {
        cwd: buildDir,
        file: archivePath,
        gzip: { level: 9 },
        mtime: new Date(0),
        noDirRecurse: true,
        portable: true
      },
      relativeFilePaths
    )
    return fs.statSync(archivePath).size
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

const measureBuild = async buildDir => {
  const absoluteBuildDir = path.resolve(buildDir)
  if (!fs.existsSync(absoluteBuildDir)) {
    throw new Error(`Build directory does not exist: ${absoluteBuildDir}`)
  }

  const entrypoints = Object.fromEntries(
    Object.entries(ENTRYPOINT_HTML).map(([name, htmlPath]) => [
      name,
      measureEntrypoint(absoluteBuildDir, htmlPath)
    ])
  )
  const allFilePaths = listFilePaths(absoluteBuildDir)
  const javascriptPaths = allFilePaths.filter(
    filePath => path.extname(filePath).toLowerCase() === '.js'
  )
  const stylesheetPaths = allFilePaths.filter(
    filePath => path.extname(filePath).toLowerCase() === '.css'
  )
  const javascript = measureFiles(javascriptPaths)
  const stylesheets = measureFiles(stylesheetPaths)
  const registryFiles = measureFiles(allFilePaths)

  return {
    entrypoints,
    generated: {
      javascript,
      stylesheets,
      total: {
        files: javascript.files + stylesheets.files,
        bytes: {
          uncompressed:
            javascript.bytes.uncompressed + stylesheets.bytes.uncompressed,
          gzip: javascript.bytes.gzip + stylesheets.bytes.gzip
        }
      }
    },
    registry: {
      files: registryFiles.files,
      bytes: {
        uncompressed: registryFiles.bytes.uncompressed,
        gzip: await measureRegistryArchive(absoluteBuildDir, allFilePaths)
      }
    }
  }
}

const formatBytes = bytes => {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

const formatReport = report => {
  const rows = [
    [
      'Entrypoint',
      'JS requests',
      'CSS requests',
      'JS uncompressed',
      'JS gzip',
      'CSS uncompressed',
      'CSS gzip',
      'Total requests',
      'Total uncompressed',
      'Total gzip'
    ],
    ...Object.entries(report.entrypoints).map(([name, entrypoint]) => [
      name,
      String(entrypoint.requests.javascript),
      String(entrypoint.requests.stylesheets),
      formatBytes(entrypoint.bytes.javascript.uncompressed),
      formatBytes(entrypoint.bytes.javascript.gzip),
      formatBytes(entrypoint.bytes.stylesheets.uncompressed),
      formatBytes(entrypoint.bytes.stylesheets.gzip),
      String(entrypoint.requests.total),
      formatBytes(entrypoint.bytes.uncompressed),
      formatBytes(entrypoint.bytes.gzip)
    ])
  ]
  const columnWidths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map(row => row[columnIndex].length))
  )
  const entrypointTable = rows
    .map(row =>
      row
        .map((cell, columnIndex) => cell.padEnd(columnWidths[columnIndex]))
        .join('  ')
        .trimEnd()
    )
    .join('\n')
  const { generated, registry } = report
  const initialJavaScript = report.entrypoints.intents.initialJavaScript

  return `${entrypointTable}

Initial JavaScript (intents): ${formatBytes(
    initialJavaScript.bytes.gzip
  )} gzip (${initialJavaScript.gzipKiB.toFixed(2)} KiB)

Generated JavaScript: ${generated.javascript.files} files, ${formatBytes(
    generated.javascript.bytes.uncompressed
  )} uncompressed, ${formatBytes(generated.javascript.bytes.gzip)} gzip
Generated CSS:        ${generated.stylesheets.files} files, ${formatBytes(
    generated.stylesheets.bytes.uncompressed
  )} uncompressed, ${formatBytes(generated.stylesheets.bytes.gzip)} gzip
Generated JS + CSS:   ${generated.total.files} files, ${formatBytes(
    generated.total.bytes.uncompressed
  )} uncompressed, ${formatBytes(generated.total.bytes.gzip)} gzip
Registry artifact:    ${registry.files} files, ${formatBytes(
    registry.bytes.uncompressed
  )} uncompressed, ${formatBytes(registry.bytes.gzip)} tar.gz`
}

try {
  const options = parseCommandOptions(process.argv.slice(2))
  const report = await measureBuild(options.buildDir)
  process.stdout.write(
    options.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : `${formatReport(report)}\n`
  )
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
