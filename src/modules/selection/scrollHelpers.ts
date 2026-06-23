const SCROLL_STEP_IN_PIXELS = 10

const scrollContainerByDirection = (
  container: HTMLElement,
  direction: number[],
  step = SCROLL_STEP_IN_PIXELS
): void => {
  if (direction.length < 2) return

  container.scrollBy(direction[0] * step, direction[1] * step)
}

const scrollElementIntoViewInContainer = (
  container: HTMLElement,
  element: Element
): void => {
  const itemRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  if (itemRect.bottom > containerRect.bottom) {
    container.scrollBy({
      top: itemRect.bottom - containerRect.bottom,
      behavior: 'auto'
    })
  } else if (itemRect.top < containerRect.top) {
    container.scrollBy({
      top: itemRect.top - containerRect.top,
      behavior: 'auto'
    })
  }
}

export { scrollContainerByDirection, scrollElementIntoViewInContainer }
