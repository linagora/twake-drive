import { stackExec } from './config'

export function setFlags(
  instance: string,
  flags: Record<string, boolean | string | number>
): void {
  stackExec(`features flags --domain ${instance} '${JSON.stringify(flags)}'`)
}
