const assert = require('node:assert/strict')
const fs = require('node:fs')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const jiti = require('jiti')(__filename)

async function makeRuntime(t, running = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'twake-ports-test-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const environment = { ...process.env }
  t.after(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in environment)) delete process.env[key]
    }
    Object.assign(process.env, environment)
  })
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('COZY_E2E_') || key === 'E2E_PROJECT_NAME') {
      delete process.env[key]
    }
  }

  fs.mkdirSync(path.join(directory, 'helpers'))
  fs.copyFileSync(
    path.join(__dirname, 'ports.ts'),
    path.join(directory, 'helpers', 'ports.ts')
  )
  fs.copyFileSync(
    path.join(__dirname, 'config.ts'),
    path.join(directory, 'helpers', 'config.ts')
  )
  const ports = jiti(path.join(directory, 'helpers', 'ports.ts'))
  const { buildUsers } = jiti(path.join(directory, 'helpers', 'config.ts'))
  const dockerPath = path.join(directory, 'docker')
  fs.writeFileSync(
    dockerPath,
    `#!${process.execPath}
const assert = require('node:assert/strict')
assert.deepEqual(process.argv.slice(2), ['compose', '-f', 'docker-compose.e2e.yml', '-p', 'legacy-project', 'ps', '-q'])
process.stdout.write(${JSON.stringify(running ? 'existing-container\n' : '')})
`,
    { mode: 0o755 }
  )
  process.env.PATH = `${directory}${path.delimiter}${process.env.PATH}`

  const servers = []
  t.after(async () => {
    await Promise.all(
      servers
        .filter(server => server.listening)
        .map(server => new Promise(resolve => server.close(resolve)))
    )
  })
  const openPort = async (port = 0) => {
    const server = net.createServer()
    servers.push(server)
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '0.0.0.0', resolve)
    })
    const assignedPort = server.address().port
    if (!running) await new Promise(resolve => server.close(resolve))
    return assignedPort
  }
  const saved = {
    projectName: 'legacy-project',
    rootDomain: 'cozy.localhost',
    stackPort: await openPort(),
    adminPort: await openPort(),
    couchdbPort: await openPort()
  }
  return { ports, saved, openPort, buildUsers }
}

for (const runtime of ['E2E', 'Dev']) {
  for (const running of [true, false]) {
    test(`migrate ${running ? 'running' : 'stopped'} ${runtime} state without changing its identity or ports`, async t => {
      const { ports, saved, openPort, buildUsers } = await makeRuntime(
        t,
        running
      )
      const portsPath = ports[`${runtime.toUpperCase()}_PORTS_PATH`]
      const defaultOfficePort =
        ports[`DEFAULT_${runtime.toUpperCase()}_ONLYOFFICE_PORT`]
      const resolvePorts = ports[`resolve${runtime}Ports`]
      const getProjectName = ports[`get${runtime}ProjectName`]
      const users = buildUsers(saved.rootDomain, saved.stackPort)
      fs.writeFileSync(portsPath, JSON.stringify(saved))
      if (running && (await ports.isPortAvailable(defaultOfficePort))) {
        await openPort(defaultOfficePort)
      }

      assert.equal(getProjectName(), saved.projectName)
      const config = await resolvePorts()

      assert.deepEqual(config, {
        ...saved,
        onlyofficePort: config.onlyofficePort
      })
      assert.equal(await ports.isPortAvailable(config.onlyofficePort), true)
      if (running) assert.ok(config.onlyofficePort > defaultOfficePort)
      assert.equal(
        [saved.stackPort, saved.adminPort, saved.couchdbPort].includes(
          config.onlyofficePort
        ),
        false
      )
      assert.deepEqual(JSON.parse(fs.readFileSync(portsPath, 'utf8')), config)
      assert.deepEqual(buildUsers(config.rootDomain, config.stackPort), users)
      assert.deepEqual(await resolvePorts(), config)
      assert.equal(getProjectName(), saved.projectName)
      process.env.E2E_PROJECT_NAME = 'explicit-project'
      assert.equal(getProjectName(), 'explicit-project')
    })
  }

  test(`migrate ${runtime} state using the explicit Office port and reject duplicates`, async t => {
    const { ports, saved, openPort } = await makeRuntime(t, false)
    const portsPath = ports[`${runtime.toUpperCase()}_PORTS_PATH`]
    const resolvePorts = ports[`resolve${runtime}Ports`]
    fs.writeFileSync(portsPath, JSON.stringify(saved))
    process.env.COZY_E2E_ONLYOFFICE_PORT = String(saved.stackPort)
    await assert.rejects(resolvePorts(), /configured more than once/)
    assert.deepEqual(JSON.parse(fs.readFileSync(portsPath, 'utf8')), saved)

    const officePort = await openPort()
    process.env.COZY_E2E_ONLYOFFICE_PORT = String(officePort)
    assert.deepEqual(await resolvePorts(), {
      ...saved,
      onlyofficePort: officePort
    })
  })
}
