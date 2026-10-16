import type { FrameLocator, Locator, Page } from '@playwright/test'

import { USERS, type User } from '../helpers/config'
import { expect } from '../helpers/fixtures'
import { createMoveIntent } from '../helpers/intents'

export interface MoveIntentMessage {
  type: string
  error?: { name: string; message: string }
  document?: unknown
}

export interface MovedIntentFile {
  _id: string
  _type: string
  _rev: string
  name: string
  mime: string
  size: string | number
  dir_id: string
  path: string
  driveId?: string
}

const MOVE_INTENT_FRAME = 'iframe[src*="intents"]'

function isMoveResultMessage(message: MoveIntentMessage): boolean {
  return [':done', ':exposeFrameRemoval'].some(suffix =>
    message.type.endsWith(suffix)
  )
}

export class MoveIntentPage {
  private readonly moveCounts = new Map<string, number>()
  private readonly readCounts = new Map<string, number>()
  private sharedMoveCount = 0
  constructor(
    private readonly page: Page,
    private readonly user: User = USERS.alice
  ) {
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      const id = path.match(/\/files\/([^/]+)\/?$/)?.[1]
      if (id && request.method() === 'PATCH')
        this.moveCounts.set(id, (this.moveCounts.get(id) ?? 0) + 1)
      if (id && request.method() === 'GET')
        this.readCounts.set(id, (this.readCounts.get(id) ?? 0) + 1)
      if (path.endsWith('/sharings/drives/move') && request.method() === 'POST')
        this.sharedMoveCount++
    })
  }

  async open(data: Record<string, unknown>): Promise<string> {
    await this.page.goto(`${this.user.appUrl}/#/folder`)
    const intent = await createMoveIntent(this.user)
    await this.page.evaluate(
      ({ intent, data }) => {
        const output = document.createElement('output')
        output.id = 'move-intent-messages'
        output.textContent = '[]'
        const frame = document.createElement('iframe')
        frame.dataset.testid = 'move-intent-frame'
        frame.src = intent.href
        frame.style.cssText =
          'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9999'
        output.hidden = true
        const origin = new URL(intent.href).origin
        const listener = (event: MessageEvent<MoveIntentMessage>): void => {
          if (event.source !== frame.contentWindow || event.origin !== origin)
            return
          const message = event.data
          if (!message.type?.startsWith(`intent-${intent.id}:`)) return
          const messages = JSON.parse(
            output.textContent || '[]'
          ) as MoveIntentMessage[]
          messages.push(message)
          output.textContent = JSON.stringify(messages)
          if (message.type.endsWith(':ready')) {
            frame.contentWindow?.postMessage(data, origin)
          }
          if (
            ['cancel', 'error', 'done'].some(type =>
              message.type.endsWith(`:${type}`)
            )
          ) {
            frame.remove()
            window.removeEventListener('message', listener)
          }
        }
        window.addEventListener('message', listener)
        document.body.append(output, frame)
      },
      { intent, data }
    )
    return intent.id
  }

  async messages(): Promise<MoveIntentMessage[]> {
    return JSON.parse(
      (await this.page.locator('#move-intent-messages').textContent()) || '[]'
    ) as MoveIntentMessage[]
  }

  async waitReady(): Promise<void> {
    await expect
      .poll(
        async () =>
          (await this.messages()).filter(message =>
            message.type.endsWith(':readyToUse')
          ).length
      )
      .toBe(1)
    await expect(this.frame().getByTestId('move-intent')).toBeVisible()
  }

  async expectTabs(names: string[]): Promise<void> {
    await expect(this.frame().getByRole('tab')).toHaveText(names)
  }

  row(name: string): Locator {
    const frame = this.frame()
    return frame
      .getByTestId('list-item')
      .filter({ has: frame.getByTitle(name, { exact: true }) })
  }

  async expectRowDisabled(name: string): Promise<void> {
    const row = this.row(name)
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('aria-disabled', 'true')
  }

  async navigateToFolder(name: string): Promise<void> {
    await this.row(name).getByTestId('listitem-onclick').dblclick()
    await expect(
      this.breadcrumb().getByText(name, { exact: true })
    ).toBeVisible()
  }

  async navigateToFolderOnMobile(name: string): Promise<void> {
    await this.row(name).getByTestId('listitem-onclick').tap()
    await this.expectBreadcrumb(name)
  }

  async selectSharings(): Promise<void> {
    await this.frame().getByRole('tab', { name: 'Sharings' }).click()
  }

  private breadcrumb(): Locator {
    return this.frame().getByTestId('file-picker-breadcrumb')
  }

  async expectBreadcrumb(name: string, visible = true): Promise<void> {
    const item = this.breadcrumb().getByText(name, { exact: true })
    if (visible) await expect(item).toBeVisible()
    else await expect(item).toHaveCount(0)
  }

  async expectTheme(theme: 'light' | 'dark'): Promise<void> {
    await expect(
      this.frame()
        .locator(`.TwakeTheme--${theme}`)
        .filter({ has: this.frame().getByTestId('move-intent') })
    ).toBeVisible()
  }

  async expectCanMove(): Promise<void> {
    await expect(
      this.frame().getByRole('button', { name: 'Move', exact: true })
    ).toBeEnabled()
  }

  async confirmMove(): Promise<void> {
    await this.frame()
      .getByRole('button', { name: 'Move', exact: true })
      .click()
  }

  async confirmInsideSharing(): Promise<void> {
    const dialog = this.frame().getByRole('dialog', {
      name: 'Move to a shared folder?'
    })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Ok', exact: true }).click()
  }

  async confirmOutsideSharing(name: string): Promise<void> {
    const dialog = this.frame().getByRole('dialog', {
      name: `Moving outside the ${name} folder`
    })
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole('button', { name: 'I understand', exact: true })
      .click()
  }

  async expectPartial(
    successCount: number,
    failureCount: number
  ): Promise<void> {
    await expect(
      this.frame().getByText(`Moved: ${successCount}. Failed: ${failureCount}.`)
    ).toBeVisible()
    for (const button of await this.breadcrumb().getByRole('button').all())
      await expect(button).toBeDisabled()
    await expect(
      this.frame().getByRole('button', { name: 'Create folder', exact: true })
    ).toBeDisabled()
  }

  async expectFinalizationError(): Promise<void> {
    await expect(
      this.frame().getByText(
        'Could not retrieve the selected documents and their paths.'
      )
    ).toBeVisible()
    await expect(
      this.frame().getByRole('button', { name: 'Retry', exact: true })
    ).toBeEnabled()
  }

  async retryResult(): Promise<void> {
    await this.frame()
      .getByRole('button', { name: 'Retry', exact: true })
      .click()
  }

  async createFolder(name: string): Promise<void> {
    await this.frame()
      .getByRole('button', { name: 'Create folder', exact: true })
      .click()
    await this.frame()
      .getByRole('textbox', { name: 'Folder name', exact: true })
      .fill(name)
    await this.frame()
      .getByRole('textbox', { name: 'Folder name', exact: true })
      .press('Enter')
    await expect(this.row(name)).toBeVisible()
  }

  moveRequestCount(fileId: string): number {
    return this.moveCounts.get(fileId) ?? 0
  }
  readRequestCount(fileId: string): number {
    return this.readCounts.get(fileId) ?? 0
  }
  crossDriveMoveRequestCount(): number {
    return this.sharedMoveCount
  }

  async failNextMove(fileId: string): Promise<void> {
    await this.page.route(
      url => url.pathname === `/files/${fileId}`,
      async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Injected move failure' })
        })
      },
      { times: 1 }
    )
  }

  async blockNextMove(fileId: string): Promise<() => void> {
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    await this.page.route(
      url => url.pathname === `/files/${fileId}`,
      async route => {
        await gate
        await route.continue()
      },
      { times: 1 }
    )
    return release
  }

  async failResultParentReads(
    fileId: string,
    parentId: string
  ): Promise<() => void> {
    let blocked = true
    await this.page.route(
      url => url.pathname === `/files/${parentId}`,
      async route => {
        if (
          blocked &&
          this.moveRequestCount(fileId) > 0 &&
          route.request().method() === 'GET'
        ) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Injected result parent failure' })
          })
        } else await route.continue()
      }
    )
    return () => {
      blocked = false
    }
  }

  async makeNextMoveResponseIncomplete(fileId: string): Promise<void> {
    await this.page.route(
      url => url.pathname === `/files/${fileId}`,
      async route => {
        const response = await route.fetch()
        const body = (await response.json()) as {
          data: { attributes: Record<string, unknown> }
        }
        delete body.data.attributes.mime
        await route.fulfill({ response, json: body })
      },
      { times: 1 }
    )
  }

  async waitResult(): Promise<MovedIntentFile[]> {
    await expect
      .poll(async () => (await this.messages()).some(isMoveResultMessage))
      .toBe(true)
    await expect(this.page.locator(MOVE_INTENT_FRAME)).toHaveCount(0)
    const document = (await this.messages()).find(isMoveResultMessage)?.document
    if (!Array.isArray(document))
      throw new Error('Expected an array MOVE result')
    for (const file of document) {
      expect(file).toMatchObject({
        _id: expect.any(String),
        _rev: expect.any(String),
        _type: 'io.cozy.files',
        type: 'file',
        name: expect.any(String),
        mime: expect.any(String),
        size: expect.anything(),
        dir_id: expect.any(String),
        path: expect.any(String)
      })
    }
    return document as MovedIntentFile[]
  }

  async cancel(): Promise<void> {
    await this.frame()
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    await expect(this.page.locator(MOVE_INTENT_FRAME)).toHaveCount(0)
  }

  async waitError(): Promise<MoveIntentMessage> {
    await expect
      .poll(async () =>
        (await this.messages()).some(message => message.type.endsWith(':error'))
      )
      .toBe(true)
    await expect(this.page.locator(MOVE_INTENT_FRAME)).toHaveCount(0)
    const message = (await this.messages()).find(message =>
      message.type.endsWith(':error')
    )
    if (!message) throw new Error('Expected an intent error message')
    return message
  }

  private frame(): FrameLocator {
    return this.page.frameLocator(MOVE_INTENT_FRAME)
  }
}
