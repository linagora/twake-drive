import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from 'react'

import CozyClient, { useClient } from 'cozy-client'

interface StackClient {
  fetchJSON: (method: string, path: string) => Promise<unknown>
}

const probes = new WeakMap<CozyClient, Promise<boolean>>()

interface Probe {
  installed: boolean
  definitive: boolean
}

const probeNotesApp = async (client: CozyClient): Promise<Probe> => {
  try {
    const stackClient = client.getStackClient() as StackClient
    await stackClient.fetchJSON('GET', '/apps/notes')
    return { installed: true, definitive: true }
  } catch (error) {
    // A share link reads the app only if Drive gave it the rule when creating
    // it. Any failure counts as missing, to never send the user to an absent
    // app, but only a 403 or a 404 is an answer.
    const status = (error as { status?: number }).status
    return { installed: false, definitive: status === 403 || status === 404 }
  }
}

export const fetchIsNotesInstalled = (client: CozyClient): Promise<boolean> => {
  const known = probes.get(client)
  if (known) return known

  const probe = probeNotesApp(client).then(({ installed, definitive }) => {
    // Not kept, so that the next caller asks again.
    if (!definitive) probes.delete(client)
    return installed
  })
  probes.set(client, probe)
  return probe
}

const NotesInstalledContext = createContext<boolean | null>(null)

const RETRY_DELAY_MS = 5000
const MAX_RETRIES = 3

// A failure that is not an answer is not kept in the cache: it is worth
// asking again a bit later.
const shouldAskAgain = (
  client: CozyClient,
  installed: boolean,
  attempt: number
): boolean => {
  const answered = installed || probes.has(client)
  return !answered && attempt < MAX_RETRIES
}

export const NotesInstalledProvider = ({
  children
}: {
  children: ReactNode
}): JSX.Element => {
  const client = useClient()
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!client) return
    let isMounted = true
    let retry: ReturnType<typeof setTimeout> | undefined
    const load = async (attempt: number): Promise<void> => {
      const installed = await fetchIsNotesInstalled(client)
      if (!isMounted) return
      setIsInstalled(installed)
      if (shouldAskAgain(client, installed, attempt)) {
        retry = setTimeout(
          () => void load(attempt + 1),
          RETRY_DELAY_MS * 2 ** attempt
        )
      }
    }
    void load(0)
    return (): void => {
      isMounted = false
      clearTimeout(retry)
    }
  }, [client])

  return (
    <NotesInstalledContext.Provider value={isInstalled}>
      {children}
    </NotesInstalledContext.Provider>
  )
}

/**
 * Whether the Notes app is installed on the instance serving the page, also
 * from a public share link. `null` until the stack has answered.
 */
export const useIsNotesInstalled = (): boolean | null =>
  useContext(NotesInstalledContext)
