import type { OverlayBox, OverlayRegion } from '@linagora/twake-embed'

export type SpaceOverlayStatus = 'connecting' | 'connected' | 'unavailable'

export interface SpaceOverlay {
  getStatus: () => SpaceOverlayStatus
  getBody: () => HTMLElement | null
  subscribe: (listener: () => void) => () => void
}

const SHADOW_MARGIN = 16
const CONNECT_TIMEOUT_MS = 5_000
const LOOKUP_INTERVAL_MS = 100
const REGION_DELAY_MS = 16
const FOCUS_RETRY_MS = 50
const BLOCKING_SELECTOR = '.MuiModal-root, .MuiBackdrop-root'
const HIDDEN_SELECTOR = '.MuiModal-hidden'

let connection: { overlay: SpaceOverlay | null } | null = null

export function connectSpaceOverlay(
  reportRegion: (region: OverlayRegion) => void
): SpaceOverlay | null {
  connection ??= { overlay: connect(reportRegion) }
  return connection.overlay
}

function connect(
  reportRegion: (region: OverlayRegion) => void
): SpaceOverlay | null {
  if (window.parent === window || window.name === '') return null
  const name = `${window.name}:overlay`
  const listeners = new Set<() => void>()
  let status: SpaceOverlayStatus = 'connecting'
  let body: HTMLElement | null = null

  const settle = (next: SpaceOverlayStatus): void => {
    if (status !== 'connecting') return
    status = next
    listeners.forEach(listener => listener())
  }

  const attach = (doc: Document): void => {
    mirrorStyles(document, doc)
    followRegion(doc, reportRegion, followFocus(document))
    body = doc.body
    settle('connected')
  }

  const giveUp = setTimeout(() => settle('unavailable'), CONNECT_TIMEOUT_MS)
  const find = (): void => {
    if (status !== 'connecting') return
    const overlay = findOverlay(name)
    if (overlay !== null) {
      clearTimeout(giveUp)
      attach(overlay)
      return
    }
    setTimeout(find, LOOKUP_INTERVAL_MS)
  }
  find()

  return {
    getStatus: () => status,
    getBody: () => body,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

function followFocus(app: Document): () => HTMLElement | null {
  let last: HTMLElement | null = null
  app.addEventListener('focusin', event => {
    if (event.target !== app.body) last = event.target as HTMLElement
  })
  return () => (last?.isConnected ? last : null)
}

function isLoadedOverlay(frame: Window | undefined, name: string): boolean {
  if (frame?.name !== name || frame.location.href === 'about:blank') {
    return false
  }
  return frame.document.readyState === 'complete'
}

function findOverlay(name: string): Document | null {
  const frames = Array.from(
    { length: window.parent.length },
    (_, index): Window | undefined => window.parent[index]
  )
  for (const frame of frames) {
    try {
      if (frame && isLoadedOverlay(frame, name)) return frame.document
    } catch {
      continue
    }
  }
  return null
}

function mirrorStyles(source: Document, target: Document): void {
  const sourceWindow = source.defaultView
  if (sourceWindow === null) return
  const mirror = target.createElement('style')
  mirror.dataset.mirror = ''
  target.head.appendChild(mirror)
  const linked = new Set<string>()

  const copy = (): void => {
    const css: string[] = []
    for (const sheet of Array.from(source.styleSheets)) {
      if (sheet.href !== null) {
        if (!linked.has(sheet.href)) {
          linked.add(sheet.href)
          const link = target.createElement('link')
          link.rel = 'stylesheet'
          link.href = sheet.href
          target.head.insertBefore(link, mirror)
        }
        continue
      }
      try {
        for (const rule of Array.from(sheet.cssRules)) css.push(rule.cssText)
      } catch {
        continue
      }
    }
    mirror.textContent = css.join('\n')
    copyRootAttributes(source.documentElement, target.documentElement)
  }

  let scheduled = false
  const schedule = (): void => {
    if (scheduled) return
    scheduled = true
    sourceWindow.requestAnimationFrame(() => {
      scheduled = false
      copy()
    })
  }

  const copyRule = (sheet: CSSStyleSheet, rule: string): void => {
    const copied = mirror.sheet
    if (Boolean(sheet.href) || copied === null || sheet === copied) return
    try {
      copied.insertRule(rule, copied.cssRules.length)
    } catch {
      return
    }
  }

  const prototype = sourceWindow.CSSStyleSheet.prototype
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const insertRule = prototype.insertRule
  prototype.insertRule = function (
    this: CSSStyleSheet,
    ...args: Parameters<CSSStyleSheet['insertRule']>
  ): number {
    const index = insertRule.apply(this, args)
    copyRule(this, args[0])
    schedule()
    return index
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const deleteRule = prototype.deleteRule
  prototype.deleteRule = function (
    this: CSSStyleSheet,
    ...args: Parameters<CSSStyleSheet['deleteRule']>
  ): void {
    schedule()
    deleteRule.apply(this, args)
  }
  new MutationObserver(schedule).observe(source.head, {
    childList: true,
    subtree: true,
    characterData: true
  })
  new MutationObserver(schedule).observe(source.documentElement, {
    attributes: true
  })
  copy()
}

function copyRootAttributes(source: HTMLElement, target: HTMLElement): void {
  for (const { name, value } of Array.from(source.attributes)) {
    if (name !== 'style' && target.getAttribute(name) !== value) {
      target.setAttribute(name, value)
    }
  }
}

function restoreFocus(target: HTMLElement, attempts = 10): void {
  target.focus()
  if (target.ownerDocument.activeElement === target && document.hasFocus()) {
    return
  }
  if (attempts > 1) {
    setTimeout(() => restoreFocus(target, attempts - 1), FOCUS_RETRY_MS)
  }
}

function hasClosedModal(
  doc: Document,
  previousKey: string,
  region: OverlayRegion
): boolean {
  if (previousKey !== '"full"' || region === 'full') return false
  return doc.activeElement === doc.body
}

function makeRegionSender(
  doc: Document,
  reportRegion: (region: OverlayRegion) => void,
  lastAppFocus: () => HTMLElement | null
): () => void {
  let last = ''
  return () => {
    const region = computeOverlayRegion(doc)
    const key = JSON.stringify(region)
    if (key === last) return
    const closedModal = hasClosedModal(doc, last, region)
    last = key
    reportRegion(region)
    const target = closedModal ? lastAppFocus() : null
    if (target !== null) restoreFocus(target)
  }
}

function followRegion(
  doc: Document,
  reportRegion: (region: OverlayRegion) => void,
  lastAppFocus: () => HTMLElement | null
): void {
  const view = doc.defaultView
  if (view === null) return
  const send = makeRegionSender(doc, reportRegion, lastAppFocus)
  let scheduled = false
  const schedule = (): void => {
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      send()
    }, REGION_DELAY_MS)
  }
  new MutationObserver(schedule).observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true
  })
  for (const type of ['transitionend', 'transitioncancel', 'animationend']) {
    doc.addEventListener(type, schedule, true)
  }
  view.addEventListener('resize', schedule)
  schedule()
}

function hasOpenModal(doc: Document, view: Window): boolean {
  return Array.from(doc.body.querySelectorAll(BLOCKING_SELECTOR)).some(
    element =>
      element.closest(HIDDEN_SELECTOR) === null &&
      view.getComputedStyle(element).visibility !== 'hidden'
  )
}

function isHidden(style: CSSStyleDeclaration): boolean {
  return style.display === 'none' || style.visibility === 'hidden'
}

function toOverlayBox(element: Element): OverlayBox | null {
  const box = element.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return null
  return {
    x: Math.floor(box.left - SHADOW_MARGIN),
    y: Math.floor(box.top - SHADOW_MARGIN),
    width: Math.ceil(box.width + 2 * SHADOW_MARGIN),
    height: Math.ceil(box.height + 2 * SHADOW_MARGIN)
  }
}

function collectBoxes(doc: Document, view: Window): OverlayBox[] {
  const boxes: OverlayBox[] = []
  const visit = (element: Element): void => {
    const style = view.getComputedStyle(element)
    if (isHidden(style)) return
    if (style.pointerEvents === 'none' && !paints(style)) {
      Array.from(element.children).forEach(visit)
      return
    }
    const box = toOverlayBox(element)
    if (box !== null) boxes.push(box)
  }
  Array.from(doc.body.children).forEach(visit)
  return boxes
}

export function computeOverlayRegion(doc: Document): OverlayRegion {
  const view = doc.defaultView
  if (view === null) return []
  if (hasOpenModal(doc, view)) return 'full'
  return collectBoxes(doc, view)
}

function paints(style: CSSStyleDeclaration): boolean {
  const transparent = (color: string): boolean =>
    color === 'transparent' || color === 'rgba(0, 0, 0, 0)'
  return (
    !transparent(style.backgroundColor) ||
    (style.boxShadow !== 'none' && style.boxShadow !== '') ||
    (style.borderStyle !== 'none' &&
      style.borderStyle !== '' &&
      parseFloat(style.borderWidth) > 0)
  )
}
