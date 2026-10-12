/* eslint-disable no-console */
// Brings up the stack of the e2e suite with the ports and compose project of the QA environment,
// then gives the accounts some files. Run by start.sh in the toolbox image.
//
// The ports and the project come from the environment (COZY_E2E_*_PORT, E2E_PROJECT_NAME); the
// runtime is recreated from scratch, as for a non persistent e2e run.
const fs = require('fs')
const path = require('path')

const jiti = require('jiti')(__filename)

const { setupStack } = jiti('../../e2e/setup/global-setup.ts')
const { USERS, stackExec } = jiti('../../e2e/helpers/config.ts')

const FIXTURES = path.join(__dirname, '..', '..', 'e2e', 'fixtures')
const ROOT_DIR_ID = 'io.cozy.files.root-dir'
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// Content the agent can browse, open, share and edit in OnlyOffice without uploading it first
const SEED = {
  alice: {
    Projects: [
      ['notes.txt', 'text/plain'],
      ['sample.txt', 'text/plain'],
      ['office-sample.docx', DOCX]
    ],
    Archive: []
  },
  bob: {
    Reports: [['office-sample.docx', DOCX]]
  }
}

// file ({ body, contentType }) is left out for a directory
async function createEntry({ user, token, dirId }, query, file = {}) {
  const { body, contentType } = file
  const res = await fetch(
    `http://${user.instance}/files/${dirId}?${new URLSearchParams(query)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.api+json',
        ...(contentType ? { 'Content-Type': contentType } : {})
      },
      body
    }
  )
  if (!res.ok) {
    throw new Error(
      `Creating ${query.Name} on ${user.instance} failed (${
        res.status
      }): ${await res.text()}`
    )
  }
  return (await res.json()).data.id
}

async function seedFiles() {
  for (const [label, folders] of Object.entries(SEED)) {
    const user = USERS[label]
    const token = stackExec(
      'instances',
      'token-cli',
      user.instance,
      'io.cozy.files'
    )
    for (const [folder, files] of Object.entries(folders)) {
      const dirId = await createEntry(
        { user, token, dirId: ROOT_DIR_ID },
        { Type: 'directory', Name: folder }
      )
      for (const [name, contentType] of files) {
        await createEntry(
          { user, token, dirId },
          { Type: 'file', Name: name },
          { body: fs.readFileSync(path.join(FIXTURES, name)), contentType }
        )
      }
      console.log(`    ${label}: /${folder} (${files.length} files)`)
    }
  }
}

async function main() {
  // Not resolveE2EPorts: it saves the ports in e2e/.e2e-ports.json, which the next `yarn e2e` of
  // the checkout would reuse
  const env = process.env
  await setupStack({
    projectName: env.E2E_PROJECT_NAME,
    rootDomain: env.COZY_E2E_ROOT_DOMAIN,
    stackPort: Number(env.COZY_E2E_STACK_PORT),
    adminPort: Number(env.COZY_E2E_ADMIN_PORT),
    couchdbPort: Number(env.COZY_E2E_COUCHDB_PORT),
    onlyofficePort: Number(env.COZY_E2E_ONLYOFFICE_PORT)
  })
  console.log('==> Adding files to the accounts')
  await seedFiles()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
