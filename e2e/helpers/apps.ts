import { stackExec } from './config'

export function isAppInstalled(instance: string, slug: string): boolean {
  const apps = stackExec('apps', 'ls', '--domain', instance)
  return apps.split('\n').some(line => line.trim().split(/\s+/, 1)[0] === slug)
}

export function ensureAppInstalled(
  instance: string,
  slug: string,
  source: string
): void {
  if (isAppInstalled(instance, slug)) return
  stackExec('apps', 'install', slug, source, '--domain', instance)
}
