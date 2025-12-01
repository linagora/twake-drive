/**
 * Updates all favicon link elements in the document head
 *
 * @param {string}faviconUrl - The URL of the favicon to set
 */
export const updateFavicon = (faviconUrl: string): void => {
  if (!faviconUrl) return

  const links = document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")

  if (!links.length) {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/svg+xml'
    link.href = faviconUrl
    document.head.appendChild(link)
    return
  }

  const currentFavicon = links[0].href
  if (currentFavicon === faviconUrl) {
    return
  }

  links.forEach(link => {
    link.href = faviconUrl
  })
}
