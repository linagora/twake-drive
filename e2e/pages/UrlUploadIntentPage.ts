import { readFile } from 'fs/promises'
import { join } from 'path'

import type { Page } from '@playwright/test'

import type { UrlUploadConfig } from '../../src/modules/services/uploadFromUrl'
import { USERS } from '../helpers/config'

export interface UploadResult {
  document?: {
    _id: string
    name: string
    dir_id: string
    size: string | number
    mime: string
  }
  error?: { name: string; message: string; status?: number }
}

export class UrlUploadIntentPage {
  readonly #page: Page

  constructor(page: Page) {
    this.#page = page
  }

  async open(): Promise<void> {
    await this.#page.goto(USERS.alice.appUrl)
    await this.#page.locator('[data-cozy]').waitFor({ state: 'attached' })
  }

  async openManual(): Promise<void> {
    await this.open()
    const html = await readFile(
      join(__dirname, '../fixtures/url-upload-caller.html'),
      'utf8'
    )
    await this.#page.exposeFunction(
      'runLocalUrlUpload',
      async (data: UrlUploadConfig) => {
        try {
          return await this.upload(data)
        } finally {
          await this.#page
            .getByTestId('url-upload-service')
            .evaluateAll(frames => {
              for (const frame of frames) frame.remove()
            })
        }
      }
    )
    await this.#page.evaluate(html => {
      const cozyData = document
        .querySelector('[data-cozy]')!
        .getAttribute('data-cozy')!
      document.body.innerHTML = html
      // Keep only the existing page's in-memory authentication for the test caller.
      document.body.dataset.cozy = cozyData
      const form = document.querySelector<HTMLFormElement>('#url-upload-form')!
      const result = document.querySelector<HTMLElement>('#url-upload-result')!
      const button = form.querySelector<HTMLButtonElement>('button')!
      form.addEventListener('submit', async event => {
        event.preventDefault()
        const data = new FormData(form)
        button.disabled = true
        result.textContent = 'Uploading…'
        try {
          const callerWindow = window as typeof window & {
            runLocalUrlUpload: (data: UrlUploadConfig) => Promise<UploadResult>
          }
          const outcome = await callerWindow.runLocalUrlUpload({
            url: String(data.get('url')),
            folderId: String(data.get('folderId')),
            name: String(data.get('name'))
          })
          result.textContent = JSON.stringify(outcome, null, 2)
        } catch {
          result.textContent =
            'Caller failed to run the intent. Check that the local Stack is running.'
        } finally {
          button.disabled = false
        }
      })
    }, html)
  }

  async submitManual(url: string, name: string): Promise<void> {
    await this.#page
      .getByRole('textbox', { name: 'URL', exact: true })
      .fill(url)
    await this.#page
      .getByRole('textbox', { name: 'File name', exact: true })
      .fill(name)
    await this.#page
      .getByRole('button', { name: 'Upload', exact: true })
      .click()
  }

  async getManualResult(): Promise<string> {
    return (await this.#page.getByRole('status').textContent()) || ''
  }

  async upload(data: UrlUploadConfig): Promise<UploadResult> {
    return this.#page.evaluate(
      async ({ data, instance }) => {
        const cozy = JSON.parse(
          document.querySelector('[data-cozy]')!.getAttribute('data-cozy')!
        )
        const response = await fetch(`http://${instance}/intents`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${cozy.token}`,
            'Content-Type': 'application/vnd.api+json'
          },
          body: JSON.stringify({
            data: {
              type: 'io.cozy.intents',
              attributes: { action: 'UPLOAD', type: 'io.cozy.files', data }
            }
          })
        })
        if (!response.ok)
          throw new Error(
            `Intent creation failed: ${
              response.status
            }: ${await response.text()}`
          )
        const { data: intent } = await response.json()
        const service =
          intent.attributes.services.find(
            (entry: { slug: string }) => entry.slug === 'drive'
          ) || intent.attributes.services[0]
        if (!service) throw new Error('No UPLOAD service registered')
        const frame = document.createElement('iframe')
        frame.dataset.testid = 'url-upload-service'
        frame.hidden = true
        const origin = new URL(service.href).origin
        const result = new Promise<UploadResult>(resolve => {
          const handleMessage = (event: MessageEvent): void => {
            if (event.origin !== origin || event.source !== frame.contentWindow)
              return
            if (event.data.type === `intent-${intent.id}:ready`) {
              frame.contentWindow!.postMessage(data, origin)
            } else if (
              [
                `intent-${intent.id}:done`,
                `intent-${intent.id}:error`,
                `intent-${intent.id}:cancel`
              ].includes(event.data.type)
            ) {
              window.removeEventListener('message', handleMessage)
              resolve(event.data)
            }
          }
          window.addEventListener('message', handleMessage)
        })
        frame.src = service.href
        document.body.append(frame)
        return result
      },
      { data, instance: USERS.alice.instance }
    )
  }

  async inspectAndClose(): Promise<{ hidden: boolean; content: string }> {
    const frame = this.#page.getByTestId('url-upload-service')
    const content = await frame.contentFrame().locator('#main').textContent()
    const hidden = !(await frame.isVisible())
    await frame.evaluate(element => element.remove())
    return { hidden, content: content || '' }
  }
}
