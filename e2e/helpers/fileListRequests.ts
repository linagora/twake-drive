import type { Page, Request } from '@playwright/test'

/** Start before navigation so absence checks include pagination already in flight. */
export class FileListRequests {
  readonly pending: Set<Request> = new Set()
  revision: number = 0

  constructor(page: Page) {
    let navigationRequest: Request | null = null
    page.on('request', request => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        navigationRequest = request
      }
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
    // Reloads can abandon old-document requests without a completion event.
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame() && navigationRequest !== null) {
        this.pending.clear()
        this.revision += 1
        navigationRequest = null
      }
    })
    page.on('requestfinished', finishRequest)
    page.on('requestfailed', request => {
      if (request === navigationRequest) navigationRequest = null
      finishRequest(request)
    })
  }
}
