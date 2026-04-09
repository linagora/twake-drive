import { ACTION_PICK } from '../constants'
import PickHandler from './PickHandler'

// Registry of OpenBuro capability handlers. Adding a new capability is a matter
// of creating a new handler directory and registering its component here.
export const capabilityHandlers = {
  [ACTION_PICK]: PickHandler
}
