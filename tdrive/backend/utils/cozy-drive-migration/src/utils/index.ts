import authAxios from './authAxios'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const BACKEND_URL = process.env.BACKEND_URL
const BACKEND_URL_PROXY = process.env.BACKEND_URL_PROXY || BACKEND_URL
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

export async function migrateUser(userID: string): Promise<number> {
  const resp = await authAxios.post(
    `${BACKEND_URL_PROXY}/internal/services/users/v1/users/${userID}/migrated`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
  return resp.status
}

export async function migrateFile(companyID: string, fileID: string): Promise<number> {
  const resp = await authAxios.post(
    `${BACKEND_URL_PROXY}/internal/services/documents/v1/companies/${companyID}/item/${fileID}/migrated`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
  return resp.status
}

export async function downloadFile(companyID: string, fileID: string): Promise<Buffer<ArrayBuffer>> {
  const fileDownloadUrl = `${BACKEND_URL_PROXY}/internal/services/documents/v1/companies/${companyID}/item/${fileID}/download`;
  const resp = await authAxios.get(fileDownloadUrl, {
    responseType: 'arraybuffer',
  });
  return Buffer.from(resp.data, 'binary');
}