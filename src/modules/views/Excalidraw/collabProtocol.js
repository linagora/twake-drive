// Pure, transport-agnostic helpers for the Excalidraw realtime collaboration
// protocol. Everything that does not touch React, cozy-client, or the Excalidraw
// imperative API lives here so it stays easy to read and test in isolation.

// The room is the file id, on the io.cozy.files channel: a POST
// /realtime/io.cozy.files/<fileId> is relayed to every subscriber without being
// persisted. We ride io.cozy.files (rather than a dedicated doctype) because it
// is the only channel both a logged-in owner and a public-share guest can reach
// — the guest's sharecode grants GET (subscribe) and, for a write link, POST
// (broadcast) on the shared file, but never a custom doctype. Our 'notified'
// events do not collide with the 'created'/'updated'/'deleted' file events.
export const COLLAB_DOCTYPE = 'io.cozy.files'

// Presence is rebuilt client-side from heartbeats since the cozy hub does not
// track room membership. A peer is dropped after PEER_TTL_MS without a message,
// i.e. three missed pings.
export const PING_INTERVAL_MS = 5000
export const PEER_TTL_MS = 15000
export const PRESENCE_SWEEP_MS = 5000

// onPointerUpdate fires on every mouse move and each send is a full HTTP POST,
// so cap the cursor rate hard — there is no server-side rate limiting on the
// realtime endpoint.
export const CURSOR_THROTTLE_MS = 100

export const MESSAGE_TYPES = {
  SCENE_UPDATE: 'SCENE_UPDATE', // elements (+ newly added images), reconciled per element
  SCENE_INIT: 'SCENE_INIT', // full scene handed to a newcomer, targeted by session id
  MOUSE_LOCATION: 'MOUSE_LOCATION', // cursor position (volatile)
  PRESENCE_HELLO: 'PRESENCE_HELLO', // "I joined" — triggers the resync handshake
  PRESENCE_PING: 'PRESENCE_PING', // heartbeat
  PRESENCE_BYE: 'PRESENCE_BYE' // clean departure (best effort)
}

const hashString = string => {
  let hash = 0
  for (let i = 0; i < string.length; i++) {
    hash = (hash << 5) - hash + string.charCodeAt(i)
    hash |= 0 // keep it a 32-bit int
  }
  return Math.abs(hash)
}

/**
 * Generates a unique-per-tab session id, the client-side substitute for
 * Socket.IO's socket.id. Used both as the presence map key and the auto-echo
 * filter.
 *
 * @returns {string}
 */
export const makeSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * Derives a stable collaborator color from a session id, so the same peer keeps
 * the same cursor color across everyone's screen without a server assigning it.
 *
 * @param {string} sessionId
 * @returns {{ background: string, stroke: string }}
 */
export const colorFromSessionId = sessionId => {
  const hue = hashString(sessionId) % 360
  return {
    background: `hsl(${hue}, 70%, 80%)`,
    stroke: `hsl(${hue}, 70%, 35%)`
  }
}

/**
 * Unwraps a realtime NOTIFIED payload. sendNotification posts the message under
 * `{ data }`, which the stack echoes back as the doc, so it arrives under
 * `.data`; fall back to the doc itself for any flat delivery path.
 *
 * @param {object} doc - The object handed to the realtime handler
 * @returns {object|null} The collaboration message
 */
export const unwrapMessage = doc => {
  if (!doc) return null
  return doc.data ?? doc
}

/**
 * Elects, deterministically and without a server, which already-present peer
 * answers a newcomer's HELLO with the current scene: the existing peer with the
 * smallest session id. The newcomer never answers its own HELLO.
 *
 * @param {string} mySessionId
 * @param {string[]} knownPeerIds - Session ids currently in my presence map
 * @param {string} newcomerId - Session id of the peer that just said HELLO
 * @returns {boolean} Whether this client should send the SCENE_INIT
 */
export const shouldRespondToHello = (mySessionId, knownPeerIds, newcomerId) => {
  const existing = [mySessionId, ...knownPeerIds].filter(
    id => id !== newcomerId
  )
  // Empty means I am the newcomer (my own HELLO): stay silent.
  return existing.length > 0 && existing.every(id => mySessionId <= id)
}

/**
 * Drops peers whose last heartbeat is older than the TTL. Returns the surviving
 * map and whether anything changed, so the caller can skip a needless re-render.
 *
 * @param {Map<string, object>} peers
 * @param {number} now - Current epoch in ms
 * @param {number} ttlMs
 * @returns {{ peers: Map<string, object>, changed: boolean }}
 */
export const prunePeers = (peers, now, ttlMs) => {
  const survivors = new Map()
  for (const [id, peer] of peers) {
    if (now - peer.lastSeen <= ttlMs) survivors.set(id, peer)
  }
  return { peers: survivors, changed: survivors.size !== peers.size }
}

/**
 * Projects the internal presence map onto the Map<id, Collaborator> shape the
 * Excalidraw `updateScene({ collaborators })` API expects.
 *
 * @param {Map<string, object>} peers
 * @returns {Map<string, object>}
 */
export const collaboratorsFromPeers = peers => {
  const collaborators = new Map()
  for (const [id, peer] of peers) {
    collaborators.set(id, {
      id,
      socketId: id,
      username: peer.username,
      color: peer.color,
      pointer: peer.pointer,
      button: peer.button
    })
  }
  return collaborators
}
