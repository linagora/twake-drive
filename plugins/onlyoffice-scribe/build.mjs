// Builds the plugin as the Document Server serves it: its files, and the
// Markdown reader it imports.
// Usage: yarn build:onlyoffice-scribe, then copy plugins/onlyoffice-scribe/build
// to the sdkjs-plugins folder of the Document Server.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = dirname(fileURLToPath(import.meta.url))
const output = join(source, 'build')
const scripts = readdirSync(join(source, 'scripts')).filter(
  name => name.endsWith('.js') && !name.endsWith('.spec.js')
)

// The folder itself is kept: a Document Server may have it mounted
for (const name of ['scripts', 'vendor']) {
  rmSync(join(output, name), { recursive: true, force: true })
  mkdirSync(join(output, name), { recursive: true })
}
for (const name of ['config.json', 'index.html']) {
  cpSync(join(source, name), join(output, name))
}
for (const name of scripts) {
  cpSync(join(source, 'scripts', name), join(output, 'scripts', name))
}
cpSync(
  fileURLToPath(import.meta.resolve('marked')),
  join(output, 'vendor', 'marked.esm.js')
)
