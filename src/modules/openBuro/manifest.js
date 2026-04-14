/**
 * OpenBuro capability manifest loader.
 *
 * The JSON source lives at the project root (/openburo.json, alongside
 * manifest.webapp) and serves two roles:
 *
 *   1. It is copied verbatim into the build output as `openburo.json` at
 *      the bundle root and served publicly at `/openburo.json` (wired via
 *      rsbuild.config.mjs and manifest.webapp). Third-party OpenBuro
 *      clients fetch this URL to discover which capabilities Drive
 *      exposes and where to point their iframe/popup.
 *
 *   2. It is imported by this module so the runtime CapabilityRouter can
 *      enforce the declared contract — requests for undeclared actions
 *      are refused even if a handler happens to exist in the registry.
 *      Keeping a single file as the source of truth prevents drift
 *      between "what we advertise" and "what we accept".
 *
 * The file follows the OpenBuro manifest-registry convention established
 * by the reference example at
 * https://github.com/openburo/TechSprint-n-01-april-20206-FilePicker/blob/master/application_manifest_registry.json
 * — a top-level ARRAY of service entries. Drive publishes exactly one
 * entry (its own) at index 0.
 *
 * ⚠ `version` must be kept in sync with manifest.webapp until we wire
 * a build-time substitution. If the two drift, the published manifest
 * will lie about the installed app version.
 */

// Relative path intentionally reaches out of src/ to the project root so
// the single file at /openburo.json is both published as a static asset
// and imported for runtime enforcement.
import manifestRegistry from '../../../openburo.json'

/**
 * Drive's own capability manifest entry.
 */
export const driveManifest = manifestRegistry[0]

/**
 * Locate the manifest entry for an action.
 *
 * @param {string} action - OpenBuro action verb (e.g. "PICK")
 * @returns {object|null} The matching capability, or null if undeclared.
 */
export const findCapability = action => {
  if (!action) return null
  return (
    driveManifest.capabilities.find(capability => capability.action === action) ||
    null
  )
}

/**
 * @param {string} action
 * @returns {boolean} Whether the action is declared in the manifest.
 */
export const isActionDeclared = action => findCapability(action) !== null
