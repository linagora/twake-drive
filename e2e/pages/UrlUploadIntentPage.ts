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
