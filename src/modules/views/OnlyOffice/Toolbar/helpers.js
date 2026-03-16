// TODO: use this method from cozy-client instead
export const computeHomeApp = ({ apps, context }) => {
  const defaultRedirection =
    context && context.attributes && context.attributes.default_redirection
  let homeApp

  if (!defaultRedirection) {
    homeApp = apps.find(app => app.slug === 'home')
  } else {
    const slugRegexp = /^([^/]+)\/.*/
    const matches = defaultRedirection.match(slugRegexp)
    const defaultAppSlug = matches && matches[1]
    homeApp = apps.find(app => app.slug === defaultAppSlug)
  }

  return homeApp
}
