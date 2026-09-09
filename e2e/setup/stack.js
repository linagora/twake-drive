const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const jiti = require('jiti')(__filename)

const {
  DEV_PORTS_PATH,
  getDevProjectName,
  getDevRootDomain,
  isDockerProjectRunning,
  resolveDevPorts
} = jiti('../helpers/ports.ts')

function ensureBuildExists() {
  const manifestInBuild = path.join(process.cwd(), 'build', 'manifest.webapp')
  if (!fs.existsSync(manifestInBuild)) {
    console.log('[stack] No existing build found. Running "yarn build" once...')
    execFileSync('yarn', ['build'], {
      stdio: 'inherit',
      cwd: process.cwd()
    })
  }
}

async function start() {
  ensureBuildExists()

  const config = await resolveDevPorts()

  process.env.E2E_PROJECT_NAME = config.projectName
  process.env.COZY_E2E_ROOT_DOMAIN = config.rootDomain
  process.env.COZY_E2E_STACK_PORT = String(config.stackPort)
  process.env.COZY_E2E_ADMIN_PORT = String(config.adminPort)
  process.env.COZY_E2E_COUCHDB_PORT = String(config.couchdbPort)
  process.env.E2E_PERSIST = '1'

  console.log(`[stack] Starting Cozy Stack dev environment:`)
  console.log(`  - Project:  ${config.projectName}`)
  console.log(`  - Domain:   *.${config.rootDomain}`)
  console.log(`  - Stack:    http://localhost:${config.stackPort}`)
  console.log(`  - Admin:    http://localhost:${config.adminPort}`)
  console.log(`  - CouchDB:  http://localhost:${config.couchdbPort}`)

  const { default: globalSetup } = jiti('./global-setup.ts')
  await globalSetup()

  const { USERS } = jiti('../helpers/config.ts')

  console.log('\n' + '='.repeat(60))
  console.log(`🚀 Cozy Stack is ready for development! (${config.projectName})`)
  console.log('='.repeat(60))
  for (const user of Object.values(USERS)) {
    console.log(`👤 ${user.label.toUpperCase()}:`)
    console.log(`   App:      ${user.appUrl}`)
    console.log(`   Email:    ${user.email}`)
    console.log(`   Password: ${user.passphrase}`)
  }
  console.log('='.repeat(60))
  console.log('💡 Run "yarn watch" in another terminal for live recompilation.')
  console.log(`🛑 Run "yarn stack down" to stop this stack.\n`)
}

function stop(cleanVolumes = false) {
  const projectName = getDevProjectName()

  const args = [
    'compose',
    '-f',
    'docker-compose.e2e.yml',
    '-p',
    projectName,
    'down',
    ...(cleanVolumes ? ['--volumes'] : [])
  ]

  console.log(
    `[stack] Stopping Cozy Stack for project "${projectName}"${
      cleanVolumes ? ' (with volumes removed)' : ''
    }...`
  )

  execFileSync('docker', args, {
    stdio: 'inherit',
    cwd: process.cwd()
  })

  if (cleanVolumes && fs.existsSync(DEV_PORTS_PATH)) {
    try {
      fs.unlinkSync(DEV_PORTS_PATH)
    } catch {
      // ignore
    }
  }

  console.log(`[stack] Stack stopped.`)
}

function status() {
  const projectName = getDevProjectName()
  const running = isDockerProjectRunning(projectName)

  if (!fs.existsSync(DEV_PORTS_PATH)) {
    console.log(`[stack] No dev stack configured for this worktree yet.`)
    console.log(`💡 Run "yarn stack up" to start one.\n`)
    return
  }

  let config
  try {
    config = JSON.parse(fs.readFileSync(DEV_PORTS_PATH, 'utf-8'))
  } catch {
    console.error(`[stack] Could not read ${DEV_PORTS_PATH}`)
    return
  }

  if (!running) {
    console.log(`\n[stack] Dev stack for project "${projectName}" is currently STOPPED.`)
    console.log(`   Allocated port: http://localhost:${config.stackPort}`)
    console.log(`💡 Run "yarn stack up" to start it.\n`)
    return
  }

  process.env.E2E_PROJECT_NAME = config.projectName
  process.env.COZY_E2E_ROOT_DOMAIN = config.rootDomain || getDevRootDomain()
  process.env.COZY_E2E_STACK_PORT = String(config.stackPort)
  process.env.COZY_E2E_ADMIN_PORT = String(config.adminPort)
  const { USERS } = jiti('../helpers/config.ts')

  console.log('\n' + '='.repeat(60))
  console.log(`🚀 Cozy Stack is RUNNING for project "${config.projectName}"`)
  console.log('='.repeat(60))
  for (const user of Object.values(USERS)) {
    console.log(`👤 ${user.label.toUpperCase()}:`)
    console.log(`   App:      ${user.appUrl}`)
    console.log(`   Email:    ${user.email}`)
    console.log(`   Password: ${user.passphrase}`)
  }
  console.log('='.repeat(60))
  console.log('💡 Run "yarn watch" in another terminal for live recompilation.')
  console.log(`🛑 Run "yarn stack down" to stop this stack.\n`)
}

// CLI Dispatcher
const command = process.argv[2] || 'help'

switch (command) {
  case 'up':
  case 'start':
    start().catch(err => {
      console.error('[stack] Startup failed:', err)
      process.exit(1)
    })
    break
  case 'down':
  case 'stop':
    stop(process.argv.includes('--volumes') || process.argv.includes('-v'))
    break
  case 'reset':
    stop(true)
    start().catch(err => {
      console.error('[stack] Reset failed:', err)
      process.exit(1)
    })
    break
  case 'status':
  case 'info':
    status()
    break
  case '--help':
  case '-h':
  case 'help':
    console.log(`
yarn stack - Manage local Cozy Stack development environment

Usage:
  yarn stack <command> [options]

Commands:
  up, start       Start and provision the stack
  status          Check status and show Alice/Bob URLs
  down, stop      Stop the stack
  reset           Stop the stack, remove Docker volumes, and restart fresh

Options:
  --volumes, -v   When used with "down", removes CouchDB data volumes
  -h, --help      Show this help message
`)
    break
  default:
    console.error(`[stack] Unknown command "${command}". Run "yarn stack --help" for available commands.`)
    process.exit(1)
}
