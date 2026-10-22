import type { Page, Request } from '@playwright/test'

/** Start before navigation so absence checks include pagination already in flight. */
export class FileListRequests {
  readonly pending: Set<Request> = new Set()

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
    page.on('requestfinished', request => this.pending.delete(request))
    page.on('requestfailed', request => this.pending.delete(request))
  }
}
