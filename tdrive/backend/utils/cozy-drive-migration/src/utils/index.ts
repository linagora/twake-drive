import axios from 'axios'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
const RABBITMQ_URL = process.env.RABBITMQ_URL
const QUEUE_NAME = process.env.QUEUE_NAME || ''
const BACKEND_URL = process.env.BACKEND_URL
const BACKEND_URL_PROXY = process.env.BACKEND_URL_PROXY
const COZY_STACK = process.env.COZY_STACK
const execAsync = promisify(exec)

// utility to execute shell commands
export async function executeCommand(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command)
    return stdout
  }
  catch (error: any) {
    throw new Error(error.stderr || error.message)
  }
}

// get auth token for twake drive app
export async function getAuthToken(): Promise<string>{
  const resp = (await axios.post(`${BACKEND_URL}/api/console/v1/login`, {
    id: 'tdrive_onlyoffice',
    secret: 'c1cc66db78e1d3bb4713c55d5ab2',
  }, {
    headers: {
      'Content-Type': 'application/json',
    },
  })).data
  return resp.resource.access_token.value
}

export async function migrateUser(userID: string, token: string): Promise<number> {
  const resp = await axios.post(
    `${BACKEND_URL_PROXY}/internal/services/users/v1/users/${userID}/migrated`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  )
  return resp.status
}

export async function migrateFile(companyID: string, fileID: string, token: string): Promise<number> {
  const resp = await axios.post(
    `${BACKEND_URL_PROXY}/internal/services/documents/v1/companies/${companyID}/item/${fileID}/migrated`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  )
  return resp.status
}