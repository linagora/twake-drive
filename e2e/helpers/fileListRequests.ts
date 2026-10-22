import type { Page, Request } from '@playwright/test'

/** Start before navigation so absence checks include pagination already in flight. */
export class FileListRequests {
  readonly pending: Set<Request> = new Set()
  revision: number = 0

  constructor(page: Page) {
    page.on('request', request => {
      if (
        /^\/(files|sharings\/drives|data\/io\.cozy\.files)(\/|$)/.test(
          new URL(request.url()).pathname
        )
      ) {
        this.pending.add(request)
      }
    })
    const finishRequest = (request: Request): void => {
      if (this.pending.delete(request)) this.revision += 1
    }
    page.on('requestfinished', finishRequest)
    page.on('requestfailed', finishRequest)
  }
}
