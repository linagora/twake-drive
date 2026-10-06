const { readFileSync } = require('fs')
const { join } = require('path')
const { chromium } = require('@playwright/test')
const jiti = require('jiti')(__filename)

async function main() {
  const ports = JSON.parse(
    readFileSync(join(__dirname, '../.dev-ports.json'), 'utf8')
  )
  process.env.COZY_E2E_ROOT_DOMAIN = ports.rootDomain
  process.env.COZY_E2E_STACK_PORT = String(ports.stackPort)
  process.env.E2E_PROJECT_NAME = ports.projectName
  const { isDockerProjectRunning } = jiti('../helpers/ports.ts')
  if (!isDockerProjectRunning(ports.projectName)) {
    throw new Error('Local Stack is stopped')
  }
  const { authenticate } = jiti('../helpers/auth.ts')
  const { USERS } = jiti('../helpers/config.ts')
  const { UrlUploadIntentPage } = jiti('../pages/UrlUploadIntentPage.ts')
  const browser = await chromium.launch({ headless: false })
  const handleClose = () => {
    browser.close().catch(() => {
      process.exitCode = 1
    })
  }
  process.once('SIGINT', handleClose)
  try {
    const page = await browser.newPage()
    page.once('close', handleClose)
    await authenticate(page, 'alice')
    await new UrlUploadIntentPage(page).openManual()
    console.log(`Local caller ready in this browser: ${USERS.alice.appUrl}/`)
    console.log(
      'Refreshing returns to Drive. Close the browser to exit; the local Stack stays running.'
    )
    await new Promise(resolve => browser.once('disconnected', resolve))
  } finally {
    process.removeListener('SIGINT', handleClose)
    await browser.close()
  }
}

main().catch(() => {
  console.error(
    'Could not open the local caller. Run yarn build, yarn stack up, and ensure a graphical display is available.'
  )
  process.exitCode = 1
})
